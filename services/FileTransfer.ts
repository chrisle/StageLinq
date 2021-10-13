import { strict as assert } from 'assert';
import { ReadContext } from "../utils/ReadContext";
import { WriteContext } from '../utils/WriteContext';
import { Service } from "./Service";

const MAGIC_MARKER = 'fltx';

// FIXME: Strongly type this for all possible messages?
type FileTransferData = any;

enum MessageId {
	TimeCode = 0x0,
	SourceLocations = 0x3,
	EndOfMessage = 0x2,
	FileStat = 0x1,
	Unknown0 = 0x8,
}

export class FileTransfer extends Service<FileTransferData> {
	async init() {
	}

	protected parseData(p_ctx: ReadContext): ServiceMessage<FileTransferData> {
		const check = p_ctx.getString(4);
		assert(check === MAGIC_MARKER);
		const code = p_ctx.readUInt32();

		// If first 4 bytes are non-zero, a timecode is sent
		if (code > 0) {
			assert(p_ctx.sizeLeft() === 8);
			const id = p_ctx.readUInt32();
			assert(id === 0x07d2);
			assert(p_ctx.readUInt32() === 0);
			return {
				id: MessageId.TimeCode,
				message: {
					timecode: code
				}
			}
		}

		// Else
		const messageId: MessageId = p_ctx.readUInt32();
		switch (messageId) {
			case MessageId.SourceLocations: {
				const sources: string[] = [];
				const sourceCount = p_ctx.readUInt32();
				for (let i = 0; i < sourceCount; ++i) {
					// We get a location
					const location = p_ctx.readNetworkStringUTF16();
					sources.push(location);
				}
				// Final three bytes should be 0x1 0x1 0x1
				assert(p_ctx.readUInt8() === 0x1);
				assert(p_ctx.readUInt8() === 0x1);
				assert(p_ctx.readUInt8() === 0x1);
				assert(p_ctx.isEOF());
				return {
					id: MessageId.SourceLocations,
					message: {
						sources: sources
					}
				}
			}

			case MessageId.FileStat: {
				assert(p_ctx.sizeLeft() === 53);
				// Last 4 bytes (FAT32) indicate size of file
				p_ctx.seek(49);
				const size = p_ctx.readUInt32();
				return {
					id: MessageId.FileStat,
					message: {
						size: size
					}
				}
			}

			case MessageId.EndOfMessage: {
				// End of result indication?
				return {
					id: MessageId.EndOfMessage,
					message: null
				}
			}

			case MessageId.Unknown0: {
				return {
					id: messageId,
					message: null
				}
			}

			default: {
				assert.fail(`Unhandled message id '${messageId}'`);
			} break;
		}
	}

	protected messageHandler(p_data: ServiceMessage<FileTransferData>) : void {
		console.log(p_data);
	}

	async requestSources() : Promise<object> {
		{
			const ctx = new WriteContext();
			ctx.writeFixedSizedString('fltx');
			ctx.writeUInt32(0x0);
			ctx.writeUInt32(0x7d2); // Database query
			ctx.writeUInt32(0x0);
			await this.writeWithLength(ctx);
		}

		const result = [];

		const message = await this.waitForMessage(MessageId.SourceLocations);
		if (message) {
			for (const source of message.sources) {
				const database = `/${source}/Engine Library/m.db`;
				{
					// Request size
					const ctx = new WriteContext();
					ctx.writeFixedSizedString('fltx');
					ctx.writeUInt32(0x0);
					ctx.writeUInt32(0x7d1); // fstat
					ctx.writeNetworkStringUTF16(database);
					await this.writeWithLength(ctx);
				}
				const fstatMessage = await this.waitForMessage(MessageId.FileStat);
				console.log(fstatMessage);
				result.push({
					source: source,
					database: {
						location: database,
						size: fstatMessage.size
					}
				});
			}
		}

		return result;
	}
}