import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCompletedContractStatus,
  isRatingRequestNotification,
  resolveRatingTargetFromContract,
} from '../src/utils/ratingFlow.js';

test('isCompletedContractStatus matches completed only', () => {
  assert.equal(isCompletedContractStatus('completed'), true);
  assert.equal(isCompletedContractStatus('COMPLETED'), true);
  assert.equal(isCompletedContractStatus('signed'), false);
  assert.equal(isCompletedContractStatus(null), false);
});

test('isRatingRequestNotification requires type and contract id', () => {
  assert.equal(
    isRatingRequestNotification({ type: 'RATING_REQUEST', data: { contractId: 'ct-1' } }),
    true
  );
  assert.equal(
    isRatingRequestNotification({ type: 'shipment_update', data: { contractId: 'ct-1' } }),
    false
  );
  assert.equal(
    isRatingRequestNotification({ type: 'RATING_REQUEST', data: {} }),
    false
  );
});

test('resolveRatingTargetFromContract resolves bidder for listing owner', () => {
  const contract = {
    id: 'ct-1',
    listingOwnerId: 'shipper-1',
    bidderId: 'trucker-1',
    bidderName: 'Juan Trucker',
  };

  const ratingTarget = resolveRatingTargetFromContract(contract, 'shipper-1');
  assert.deepEqual(ratingTarget, {
    contract,
    userToRate: { id: 'trucker-1', name: 'Juan Trucker' },
  });
});

test('resolveRatingTargetFromContract resolves owner for bidder', () => {
  const contract = {
    id: 'ct-2',
    listingOwnerId: 'shipper-2',
    bidderId: 'trucker-2',
    listingOwnerName: 'Ana Shipper',
  };

  const ratingTarget = resolveRatingTargetFromContract(contract, 'trucker-2');
  assert.deepEqual(ratingTarget, {
    contract,
    userToRate: { id: 'shipper-2', name: 'Ana Shipper' },
  });
});

test('resolveRatingTargetFromContract rejects non-participants', () => {
  const contract = {
    id: 'ct-3',
    listingOwnerId: 'shipper-3',
    bidderId: 'trucker-3',
  };

  assert.equal(resolveRatingTargetFromContract(contract, 'other-user'), null);
  assert.equal(resolveRatingTargetFromContract(contract, ''), null);
});
