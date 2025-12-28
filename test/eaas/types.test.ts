import { describe, it, expect } from 'vitest';
import {
  EAAS_DISCOVERY_PORT,
  EAAS_GRPC_PORT,
  EAAS_HTTP_PORT,
  EAAS_MAGIC,
  EAAS_REQUEST_TYPE,
  EAAS_RESPONSE_TYPE,
} from '../../eaas/types';

describe('EAAS types', () => {
  describe('constants', () => {
    it('has correct discovery port', () => {
      expect(EAAS_DISCOVERY_PORT).toBe(11224);
    });

    it('has correct gRPC port', () => {
      expect(EAAS_GRPC_PORT).toBe(50010);
    });

    it('has correct HTTP port', () => {
      expect(EAAS_HTTP_PORT).toBe(50020);
    });

    it('has HTTP port 10 higher than gRPC port', () => {
      expect(EAAS_HTTP_PORT - EAAS_GRPC_PORT).toBe(10);
    });

    it('has correct magic bytes', () => {
      expect(EAAS_MAGIC).toBe('EAAS');
    });

    it('has correct request type', () => {
      expect(EAAS_REQUEST_TYPE).toBe(0x00);
    });

    it('has correct response type', () => {
      expect(EAAS_RESPONSE_TYPE).toBe(0x01);
    });

    it('request and response types are different', () => {
      expect(EAAS_REQUEST_TYPE).not.toBe(EAAS_RESPONSE_TYPE);
    });
  });
});
