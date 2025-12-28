--[[
  StageLinQ Protocol Dissector for Wireshark

  Decodes StageLinQ protocol messages for Denon DJ devices.
  Supports discovery, StateMap, FileTransfer, BeatInfo, and other services.

  Installation:
    Copy this file to your Wireshark plugins directory:
    - Windows: %APPDATA%\Wireshark\plugins\
    - macOS: ~/.local/lib/wireshark/plugins/
    - Linux: ~/.local/lib/wireshark/plugins/

  Usage:
    Filter by: stagelinq or stagelinq.discovery or stagelinq.statemap

  Protocol documentation based on:
    - chrisle/StageLinq TypeScript implementation
    - icedream/go-stagelinq Go implementation
    - Jaxc/PyStageLinQ Python implementation

  Ported from PyStageLinQ by Jaxc
  Original: https://github.com/Jaxc/PyStageLinQ
  License: MIT
]]

-- Protocol declaration
local stagelinq_proto = Proto("stagelinq", "StageLinQ Protocol")
local stagelinq_discovery = Proto("stagelinq_discovery", "StageLinQ Discovery")
local stagelinq_statemap = Proto("stagelinq_statemap", "StageLinQ StateMap")
local stagelinq_filetransfer = Proto("stagelinq_filetransfer", "StageLinQ FileTransfer")
local stagelinq_beatinfo = Proto("stagelinq_beatinfo", "StageLinQ BeatInfo")

-- Constants
local DISCOVERY_PORT = 51337
local DISCOVERY_MAGIC = "airD"
local STATEMAP_MAGIC = "smaa"
local FILETRANSFER_MAGIC = "fltx"

-- Message type IDs
local MESSAGE_ID = {
  SERVICES_ANNOUNCEMENT = 0,
  TIMESTAMP = 1,
  SERVICES_REQUEST = 2,
}

local FILETRANSFER_MSG = {
  TIMECODE = 0,
  FILE_STAT = 1,
  END_OF_MESSAGE = 2,
  SOURCE_LOCATIONS = 3,
  FILE_TRANSFER_ID = 4,
  FILE_TRANSFER_CHUNK = 5,
  UNKNOWN_8 = 8,
  SERVICE_DISCONNECT = 9,
}

local STATEMAP_MSG = {
  JSON_STATE = 0x00000000,
  INTERVAL_SUB = 0x000007d2,
}

-- Known device tokens for identification
local KNOWN_TOKENS = {
  ["52fdfcc721826541563f5f0f9a621d72"] = "SoundSwitch",
  ["828beb02da1f4e68a6afb0b167eaf0a2"] = "SC6000 (1)",
  ["26d238671cd64e3f80a111826ac41120"] = "SC6000 (2)",
  ["88fa2099ac7a4f3fbc16a995dbda2a42"] = "Resolume",
}

--------------------------------------------------------------------------------
-- Discovery Protocol Fields
--------------------------------------------------------------------------------
local discovery_fields = {
  magic = ProtoField.string("stagelinq.discovery.magic", "Magic"),
  token = ProtoField.bytes("stagelinq.discovery.token", "Token"),
  token_name = ProtoField.string("stagelinq.discovery.token_name", "Token Name"),
  source = ProtoField.string("stagelinq.discovery.source", "Source"),
  action = ProtoField.string("stagelinq.discovery.action", "Action"),
  software_name = ProtoField.string("stagelinq.discovery.software_name", "Software Name"),
  software_version = ProtoField.string("stagelinq.discovery.software_version", "Software Version"),
  port = ProtoField.uint16("stagelinq.discovery.port", "Port", base.DEC),
}

stagelinq_discovery.fields = discovery_fields

--------------------------------------------------------------------------------
-- StateMap Protocol Fields
--------------------------------------------------------------------------------
local statemap_fields = {
  magic = ProtoField.string("stagelinq.statemap.magic", "Magic"),
  msg_type = ProtoField.uint32("stagelinq.statemap.type", "Message Type", base.HEX),
  state_name = ProtoField.string("stagelinq.statemap.state_name", "State Name"),
  json_data = ProtoField.string("stagelinq.statemap.json_data", "JSON Data"),
  interval = ProtoField.int32("stagelinq.statemap.interval", "Interval (ms)"),
}

stagelinq_statemap.fields = statemap_fields

--------------------------------------------------------------------------------
-- FileTransfer Protocol Fields
--------------------------------------------------------------------------------
local filetransfer_fields = {
  magic = ProtoField.string("stagelinq.filetransfer.magic", "Magic"),
  type_id = ProtoField.uint32("stagelinq.filetransfer.type_id", "Type ID", base.HEX),
  msg_id = ProtoField.uint32("stagelinq.filetransfer.msg_id", "Message ID", base.HEX),
  source_count = ProtoField.uint32("stagelinq.filetransfer.source_count", "Source Count"),
  source_name = ProtoField.string("stagelinq.filetransfer.source_name", "Source Name"),
  txid = ProtoField.uint32("stagelinq.filetransfer.txid", "Transaction ID"),
  file_size = ProtoField.uint32("stagelinq.filetransfer.file_size", "File Size"),
  chunk_size = ProtoField.uint32("stagelinq.filetransfer.chunk_size", "Chunk Size"),
}

stagelinq_filetransfer.fields = filetransfer_fields

--------------------------------------------------------------------------------
-- BeatInfo Protocol Fields
--------------------------------------------------------------------------------
local beatinfo_fields = {
  id = ProtoField.uint32("stagelinq.beatinfo.id", "ID", base.HEX),
  clock = ProtoField.uint64("stagelinq.beatinfo.clock", "Clock"),
  deck_count = ProtoField.uint32("stagelinq.beatinfo.deck_count", "Deck Count"),
  deck_num = ProtoField.uint32("stagelinq.beatinfo.deck_num", "Deck Number"),
  beat = ProtoField.double("stagelinq.beatinfo.beat", "Beat"),
  total_beats = ProtoField.double("stagelinq.beatinfo.total_beats", "Total Beats"),
  bpm = ProtoField.double("stagelinq.beatinfo.bpm", "BPM"),
  samples = ProtoField.double("stagelinq.beatinfo.samples", "Samples"),
}

stagelinq_beatinfo.fields = beatinfo_fields

--------------------------------------------------------------------------------
-- Main Protocol Fields
--------------------------------------------------------------------------------
local main_fields = {
  msg_length = ProtoField.uint32("stagelinq.length", "Message Length", base.DEC),
  msg_id = ProtoField.uint32("stagelinq.msg_id", "Message ID", base.HEX),
  token = ProtoField.bytes("stagelinq.token", "Token"),
  service_name = ProtoField.string("stagelinq.service_name", "Service Name"),
  service_port = ProtoField.uint16("stagelinq.service_port", "Service Port"),
  timestamp = ProtoField.uint64("stagelinq.timestamp", "Timestamp"),
}

stagelinq_proto.fields = main_fields

--------------------------------------------------------------------------------
-- Helper Functions
--------------------------------------------------------------------------------

-- Read a big-endian uint32
local function read_uint32(buffer, offset)
  if offset + 4 > buffer:len() then return nil, offset end
  return buffer(offset, 4):uint(), offset + 4
end

-- Read a big-endian uint16
local function read_uint16(buffer, offset)
  if offset + 2 > buffer:len() then return nil, offset end
  return buffer(offset, 2):uint(), offset + 2
end

-- Read a big-endian uint64
local function read_uint64(buffer, offset)
  if offset + 8 > buffer:len() then return nil, offset end
  return buffer(offset, 8):uint64(), offset + 8
end

-- Read a big-endian float64
local function read_float64(buffer, offset)
  if offset + 8 > buffer:len() then return nil, offset end
  return buffer(offset, 8):float(), offset + 8
end

-- Read a network UTF-16 string (length-prefixed, big-endian)
local function read_network_string_utf16(buffer, offset)
  local len, new_offset = read_uint32(buffer, offset)
  if len == nil or new_offset + len > buffer:len() then
    return nil, offset
  end

  -- Decode UTF-16 big-endian
  local chars = {}
  for i = 0, len - 2, 2 do
    local code = buffer(new_offset + i, 2):uint()
    if code > 0 then
      table.insert(chars, string.char(code))
    end
  end

  return table.concat(chars), new_offset + len
end

-- Read a fixed-size ASCII string
local function read_ascii(buffer, offset, len)
  if offset + len > buffer:len() then return nil, offset end
  local str = buffer(offset, len):string()
  -- Remove null bytes
  str = str:gsub("%z", "")
  return str, offset + len
end

-- Format a token as hex string
local function token_to_hex(buffer, offset)
  if offset + 16 > buffer:len() then return nil end
  local hex = ""
  for i = 0, 15 do
    hex = hex .. string.format("%02x", buffer(offset + i, 1):uint())
  end
  return hex
end

-- Look up token name
local function get_token_name(hex)
  return KNOWN_TOKENS[hex] or "Unknown"
end

--------------------------------------------------------------------------------
-- Discovery Dissector
--------------------------------------------------------------------------------
function stagelinq_discovery.dissector(buffer, pinfo, tree)
  local offset = 0

  -- Check minimum length
  if buffer:len() < 4 then return end

  -- Check magic
  local magic = buffer(0, 4):string()
  if magic ~= DISCOVERY_MAGIC then return end

  pinfo.cols.protocol = "StageLinQ Discovery"

  local subtree = tree:add(stagelinq_discovery, buffer(), "StageLinQ Discovery Message")

  -- Magic
  subtree:add(discovery_fields.magic, buffer(offset, 4))
  offset = offset + 4

  -- Token (16 bytes)
  subtree:add(discovery_fields.token, buffer(offset, 16))
  local token_hex = token_to_hex(buffer, offset)
  local token_name = get_token_name(token_hex)
  subtree:add(discovery_fields.token_name, token_name)
  offset = offset + 16

  -- Source
  local source, new_offset = read_network_string_utf16(buffer, offset)
  if source then
    subtree:add(discovery_fields.source, source)
    offset = new_offset
  end

  -- Action
  local action
  action, offset = read_network_string_utf16(buffer, offset)
  if action then
    subtree:add(discovery_fields.action, action)
    pinfo.cols.info = action
  end

  -- Software name
  local sw_name
  sw_name, offset = read_network_string_utf16(buffer, offset)
  if sw_name then
    subtree:add(discovery_fields.software_name, sw_name)
    pinfo.cols.info:append(" - " .. sw_name)
  end

  -- Software version
  local sw_version
  sw_version, offset = read_network_string_utf16(buffer, offset)
  if sw_version then
    subtree:add(discovery_fields.software_version, sw_version)
  end

  -- Port
  if offset + 2 <= buffer:len() then
    local port = buffer(offset, 2):uint()
    subtree:add(discovery_fields.port, buffer(offset, 2))
  end
end

--------------------------------------------------------------------------------
-- StateMap Dissector
--------------------------------------------------------------------------------
function stagelinq_statemap.dissector(buffer, pinfo, tree)
  local offset = 0

  if buffer:len() < 8 then return end

  local magic = buffer(0, 4):string()
  if magic ~= STATEMAP_MAGIC then return end

  pinfo.cols.protocol = "StageLinQ StateMap"

  local subtree = tree:add(stagelinq_statemap, buffer(), "StageLinQ StateMap Message")

  -- Magic
  subtree:add(statemap_fields.magic, buffer(offset, 4))
  offset = offset + 4

  -- Message type
  local msg_type = buffer(offset, 4):uint()
  subtree:add(statemap_fields.msg_type, buffer(offset, 4))
  offset = offset + 4

  if msg_type == STATEMAP_MSG.JSON_STATE then
    -- JSON state update
    local state_name, new_offset = read_network_string_utf16(buffer, offset)
    if state_name then
      subtree:add(statemap_fields.state_name, state_name)
      offset = new_offset
      pinfo.cols.info = "State: " .. state_name
    end

    local json_data
    json_data, offset = read_network_string_utf16(buffer, offset)
    if json_data then
      subtree:add(statemap_fields.json_data, json_data)
    end
  elseif msg_type == STATEMAP_MSG.INTERVAL_SUB then
    -- Interval subscription
    local state_name
    state_name, offset = read_network_string_utf16(buffer, offset)
    if state_name then
      subtree:add(statemap_fields.state_name, state_name)
      pinfo.cols.info = "Subscribe: " .. state_name
    end

    if offset + 4 <= buffer:len() then
      local interval = buffer(offset, 4):int()
      subtree:add(statemap_fields.interval, buffer(offset, 4))
    end
  end
end

--------------------------------------------------------------------------------
-- FileTransfer Dissector
--------------------------------------------------------------------------------
function stagelinq_filetransfer.dissector(buffer, pinfo, tree)
  local offset = 0

  if buffer:len() < 12 then return end

  local magic = buffer(0, 4):string()
  if magic ~= FILETRANSFER_MAGIC then return end

  pinfo.cols.protocol = "StageLinQ FileTransfer"

  local subtree = tree:add(stagelinq_filetransfer, buffer(), "StageLinQ FileTransfer Message")

  -- Magic
  subtree:add(filetransfer_fields.magic, buffer(offset, 4))
  offset = offset + 4

  -- Type ID
  local type_id = buffer(offset, 4):uint()
  subtree:add(filetransfer_fields.type_id, buffer(offset, 4))
  offset = offset + 4

  -- Message ID
  local msg_id = buffer(offset, 4):uint()
  subtree:add(filetransfer_fields.msg_id, buffer(offset, 4))
  offset = offset + 4

  local msg_names = {
    [FILETRANSFER_MSG.TIMECODE] = "TimeCode",
    [FILETRANSFER_MSG.FILE_STAT] = "FileStat",
    [FILETRANSFER_MSG.END_OF_MESSAGE] = "EndOfMessage",
    [FILETRANSFER_MSG.SOURCE_LOCATIONS] = "SourceLocations",
    [FILETRANSFER_MSG.FILE_TRANSFER_ID] = "FileTransferId",
    [FILETRANSFER_MSG.FILE_TRANSFER_CHUNK] = "FileTransferChunk",
    [FILETRANSFER_MSG.SERVICE_DISCONNECT] = "ServiceDisconnect",
  }

  pinfo.cols.info = msg_names[msg_id] or string.format("Unknown (0x%x)", msg_id)

  if msg_id == FILETRANSFER_MSG.SOURCE_LOCATIONS then
    local source_count = buffer(offset, 4):uint()
    subtree:add(filetransfer_fields.source_count, buffer(offset, 4))
    offset = offset + 4

    for i = 1, source_count do
      local source_name
      source_name, offset = read_network_string_utf16(buffer, offset)
      if source_name then
        subtree:add(filetransfer_fields.source_name, source_name)
      end
    end
  elseif msg_id == FILETRANSFER_MSG.FILE_TRANSFER_CHUNK then
    if offset + 4 <= buffer:len() then
      subtree:add(filetransfer_fields.chunk_size, buffer(offset, 4))
    end
  end
end

--------------------------------------------------------------------------------
-- BeatInfo Dissector
--------------------------------------------------------------------------------
function stagelinq_beatinfo.dissector(buffer, pinfo, tree)
  local offset = 0

  if buffer:len() < 20 then return end

  pinfo.cols.protocol = "StageLinQ BeatInfo"

  local subtree = tree:add(stagelinq_beatinfo, buffer(), "StageLinQ BeatInfo Message")

  -- ID
  subtree:add(beatinfo_fields.id, buffer(offset, 4))
  offset = offset + 4

  -- Clock
  subtree:add(beatinfo_fields.clock, buffer(offset, 8))
  offset = offset + 8

  -- Deck count
  local deck_count = buffer(offset, 4):uint()
  subtree:add(beatinfo_fields.deck_count, buffer(offset, 4))
  offset = offset + 4

  -- Deck data
  for i = 1, deck_count do
    local deck_tree = subtree:add(stagelinq_beatinfo, buffer(offset, 24), "Deck " .. i)

    if offset + 24 <= buffer:len() then
      -- Beat
      deck_tree:add(beatinfo_fields.beat, buffer(offset, 8))
      offset = offset + 8

      -- Total beats
      deck_tree:add(beatinfo_fields.total_beats, buffer(offset, 8))
      offset = offset + 8

      -- BPM
      deck_tree:add(beatinfo_fields.bpm, buffer(offset, 8))
      offset = offset + 8
    end
  end

  -- Sample positions (optional)
  for i = 1, deck_count do
    if offset + 8 <= buffer:len() then
      subtree:add(beatinfo_fields.samples, buffer(offset, 8)):append_text(" (Deck " .. i .. ")")
      offset = offset + 8
    end
  end
end

--------------------------------------------------------------------------------
-- Main TCP Dissector
--------------------------------------------------------------------------------
function stagelinq_proto.dissector(buffer, pinfo, tree)
  local offset = 0

  if buffer:len() < 4 then return end

  -- Check for service-specific magic bytes
  local magic = buffer(0, 4):string()

  if magic == STATEMAP_MAGIC then
    stagelinq_statemap.dissector(buffer, pinfo, tree)
    return
  elseif magic == FILETRANSFER_MAGIC then
    stagelinq_filetransfer.dissector(buffer, pinfo, tree)
    return
  end

  -- Try to parse as framed TCP message
  pinfo.cols.protocol = "StageLinQ"

  local subtree = tree:add(stagelinq_proto, buffer(), "StageLinQ Message")

  -- Message ID
  local msg_id = buffer(offset, 4):uint()
  subtree:add(main_fields.msg_id, buffer(offset, 4))
  offset = offset + 4

  if msg_id == MESSAGE_ID.SERVICES_ANNOUNCEMENT then
    pinfo.cols.info = "Services Announcement"

    -- Token (16 bytes)
    if offset + 16 <= buffer:len() then
      subtree:add(main_fields.token, buffer(offset, 16))
      offset = offset + 16
    end

    -- Service name
    local service_name
    service_name, offset = read_network_string_utf16(buffer, offset)
    if service_name then
      subtree:add(main_fields.service_name, service_name)
      pinfo.cols.info:append(": " .. service_name)
    end

    -- Service port
    if offset + 2 <= buffer:len() then
      subtree:add(main_fields.service_port, buffer(offset, 2))
    end

  elseif msg_id == MESSAGE_ID.TIMESTAMP then
    pinfo.cols.info = "Timestamp"

    -- Token (16 bytes)
    if offset + 16 <= buffer:len() then
      subtree:add(main_fields.token, buffer(offset, 16))
      offset = offset + 16
    end

    -- Second token (16 bytes, usually zeros)
    offset = offset + 16

    -- Timestamp
    if offset + 8 <= buffer:len() then
      subtree:add(main_fields.timestamp, buffer(offset, 8))
    end

  elseif msg_id == MESSAGE_ID.SERVICES_REQUEST then
    pinfo.cols.info = "Services Request"

    if offset + 16 <= buffer:len() then
      subtree:add(main_fields.token, buffer(offset, 16))
    end
  else
    pinfo.cols.info = string.format("Unknown (0x%08x)", msg_id)
  end
end

--------------------------------------------------------------------------------
-- Registration
--------------------------------------------------------------------------------

-- Register UDP dissector for discovery
local udp_table = DissectorTable.get("udp.port")
udp_table:add(DISCOVERY_PORT, stagelinq_discovery)

-- Register TCP as heuristic dissector for dynamic ports
-- (Services use dynamic ports announced during discovery)
stagelinq_proto:register_heuristic("tcp", function(buffer, pinfo, tree)
  if buffer:len() < 4 then return false end

  local magic = buffer(0, 4):string()

  -- Check for known magic bytes
  if magic == STATEMAP_MAGIC or magic == FILETRANSFER_MAGIC then
    stagelinq_proto.dissector(buffer, pinfo, tree)
    return true
  end

  -- Check for message IDs
  local msg_id = buffer(0, 4):uint()
  if msg_id <= 2 then
    stagelinq_proto.dissector(buffer, pinfo, tree)
    return true
  end

  return false
end)

-- Print load message
print("StageLinQ dissector loaded - Discovery on port " .. DISCOVERY_PORT)
