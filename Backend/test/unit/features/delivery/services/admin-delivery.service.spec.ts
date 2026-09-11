import { CertificateStatus } from 'src/entities/shipperCertificateInfo.entity';
import { AdminDeliveryService } from 'src/features/delivery/services/admin/admin-delivery.service';

describe('AdminDeliveryService unit tests', () => {
  let certRepo: { findOne: jest.Mock; save: jest.Mock };
  let shippingDetailRepository: { count: jest.Mock };
  let pendingAssignmentRepository: { find: jest.Mock };
  let shipperProfileService: { findByUserId: jest.Mock; updateCertificateStatus: jest.Mock };
  let identityReader: { findIdentityUser: jest.Mock; findIdentityUsers: jest.Mock };
  let service: AdminDeliveryService;

  beforeEach(() => {
    certRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    shippingDetailRepository = {
      count: jest.fn().mockResolvedValue(10),
    };
    pendingAssignmentRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    shipperProfileService = {
      findByUserId: jest.fn().mockResolvedValue(null),
      updateCertificateStatus: jest.fn().mockResolvedValue({}),
    };
    identityReader = {
      findIdentityUser: jest.fn().mockResolvedValue(null),
      findIdentityUsers: jest.fn().mockResolvedValue([]),
    };

    service = new AdminDeliveryService(
      certRepo as never,
      shippingDetailRepository as never,
      pendingAssignmentRepository as never,
      shipperProfileService as never,
      identityReader as never,
    );
  });

  describe('approveShipper', () => {
    it('approves shipper certificate and synchronizes profile status', async () => {
      const mockCert = { id: 'cert-1', status: CertificateStatus.PENDING, verifiedAt: null };
      certRepo.findOne.mockResolvedValue(mockCert);
      certRepo.save.mockResolvedValue(mockCert);

      const result = await service.approveShipper('user-1');

      expect(result.success).toBe(true);
      expect(mockCert.status).toBe(CertificateStatus.APPROVED);
      expect(mockCert.verifiedAt).toBeInstanceOf(Date);
      expect(certRepo.save).toHaveBeenCalledWith(mockCert);
      expect(shipperProfileService.updateCertificateStatus).toHaveBeenCalledWith(
        'user-1',
        'APPROVED',
      );
    });
  });

  describe('rejectShipper', () => {
    it('rejects shipper certificate with reason', async () => {
      const mockCert = { id: 'cert-1', status: CertificateStatus.PENDING };
      certRepo.findOne.mockResolvedValue(mockCert);
      certRepo.save.mockResolvedValue(mockCert);

      const result = await service.rejectShipper('user-1', 'GPLX không hợp lệ');

      expect(result.success).toBe(true);
      expect(mockCert.status).toBe(CertificateStatus.REJECTED);
      expect(result.reason).toBe('GPLX không hợp lệ');
      expect(shipperProfileService.updateCertificateStatus).toHaveBeenCalledWith(
        'user-1',
        'REJECTED',
      );
    });
  });
});
