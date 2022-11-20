import {expect, test} from 'vitest';
import {Fire, FireBatch} from '../lib/fire';
import {FirestoreDataConverter, DocumentReference, serverTimestamp} from 'firebase/firestore';

Fire.initializeFromViteEnv();
// @ts-ignore
const testEmail = import.meta.env.VITE_FIRE_TEST_EMAIL;
// @ts-ignore
const testPassword = import.meta.env.VITE_FIRE_TEST_PASSWORD;

type TestOrder = {
  id: string;
  orderType: 'undefined' | 'dineIn' | 'takeOut';
  orderStatus: 'undefined' | 'proceeding' | 'cancelled' | 'refunded' | 'completed';
  staffId?: string;
  customerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  cancelledAt?: Date;
  refundedAt?: Date;
  completedAt?: Date;
};

const testOrderConverter: FirestoreDataConverter<TestOrder> = {
  toFirestore(model) {
    return model;
  },
  fromFirestore(snapshot, options) {
    if (!snapshot.exists()) {
      return {id: '', orderType: 'undefined', orderStatus: 'undefined'};
    }
    const {
      id, orderType, orderStatus, staffId, customerId,
      createdAt, updatedAt, cancelledAt, refundedAt, completedAt,
    } = snapshot.data(options);
    return {
      id, orderType, orderStatus, staffId, customerId,
      createdAt: createdAt?.toDate(),
      updatedAt: updatedAt?.toDate(),
      cancelledAt: cancelledAt?.toDate(),
      refundedAt: refundedAt?.toDate(),
      completedAt: completedAt?.toDate(),
    };
  },
};

function waitFor(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), milliseconds);
  });
}

test('class Fire - signIn / signOut', async () => {
  const fire = new Fire();
  await fire.signIn(testEmail, testPassword);
  expect(fire.user?.email).eq(testEmail);
  await fire.signOut();
  expect(fire.user).eq(null);
});

test('class Fire - colRef / docRef', async () => {
  const fire = new Fire();
  {
    const ordersRef = fire.colRef(['test-stores', 'demo', 'orders']);
    expect(ordersRef.path).eq('test-stores/demo/orders');
  }
  {
    const storesRef = fire.colRef('test-stores');
    expect(storesRef.path).eq('test-stores');
  }
  {
    const storesRef = fire.colRef('test-stores');
    const anotherRef = fire.colRef(storesRef);
    expect(anotherRef.path).eq('test-stores');
  }
  {
    const ordersRef = fire.colRef(['test-stores', 'demo', 'orders']);
    const orderRef = fire.docRef(ordersRef);
    expect(orderRef instanceof DocumentReference).eq(true);
  }
  {
    const orderRef = fire.docRef(['test-stores', 'demo', 'orders', 'O0001']);
    expect(orderRef.id).eq('O0001');
  }
  {
    const orderRef = fire.docRef('test-stores/demo/orders/O0002');
    expect(orderRef.id).eq('O0002');
  }
});

test('class Fire - [get|set|add|merge|update|delete]Doc', async () => {
  const fire = new Fire();
  if (fire.user === null) {
    await fire.signIn(testEmail, testPassword);
  }
  {
    ///////////////////////////////////////////////////////////////////////////
    const ordersRef = fire.colRef(['test-stores', 'demo', 'orders']);
    const orderData: TestOrder = {id: '', orderType: 'dineIn', orderStatus: 'proceeding'};
    const orderRef = await fire.addDoc(ordersRef, orderData);
    ///////////////////////////////////////////////////////////////////////////
    let order = await fire.getDoc(orderRef, testOrderConverter);
    expect(typeof order).eq('object');
    expect(order!.id).eq(orderRef.id);
    expect(order!.orderType).eq('dineIn');
    expect(order!.createdAt).instanceOf(Date);
    expect(order!.updatedAt).toBeUndefined();
    ///////////////////////////////////////////////////////////////////////////
    // await waitFor(500);
    await fire.mergeDoc(orderRef.path.split('/'), {orderType: 'takeOut'});
    order = await fire.getDoc(orderRef, testOrderConverter);
    expect(order!.orderType).eq('takeOut');
    expect(order!.updatedAt).instanceOf(Date);
    ///////////////////////////////////////////////////////////////////////////
    // await waitFor(500);
    await fire.updateDoc(orderRef, {orderStatus: 'completed', completedAt: fire.serverTs()});
    order = await fire.getDoc(orderRef, testOrderConverter);
    expect(order!.orderStatus).eq('completed');
    expect(order!.completedAt).instanceOf(Date);
    ///////////////////////////////////////////////////////////////////////////
    // await waitFor(500);
    await fire.deleteDoc(orderRef.path);
    order = await fire.getDoc(orderRef, testOrderConverter);
    expect(order).eq(null);
  }
});

test('class FireBatch', async () => {
  ///////////////////////////////////////////////////////////////////////////
  await waitFor(250);
  const countPerBatch = 495;
  const docCount = 110;
  const batch = new FireBatch(countPerBatch);
  for (let i = 1; i <= docCount; ++i) {
    const id = 'O' + i.toString().padStart(4, '0');
    const orderData: TestOrder = {id, orderType: 'dineIn', orderStatus: 'proceeding'};
    batch.set(['test-stores', 'demo', 'orders', id], orderData);
  }
  expect(batch.batchCount).eq(Math.ceil(docCount / countPerBatch));
  await batch.commit();
  ///////////////////////////////////////////////////////////////////////////
  for (let i = 1; i <= docCount; ++i) {
    const id = 'O' + i.toString().padStart(4, '0');
    batch.merge(['test-stores', 'demo', 'orders', id], {orderStatus: 'cancelled', cancelledAt: serverTimestamp()});
  }
  for (let i = 1; i <= docCount; ++i) {
    const id = 'O' + i.toString().padStart(4, '0');
    batch.update(['test-stores', 'demo', 'orders', id], {orderStatus: 'completed', completedAt: serverTimestamp()});
  }
  ///////////////////////////////////////////////////////////////////////////
  await waitFor(250);
  const fire = new Fire();
  const ordersRef = fire.colRef(['test-stores', 'demo', 'orders']);
  const orderIdList: string[] = [];
  for (let i = 1; i <= docCount; ++i) {
    const orderData: TestOrder = {id: '', orderType: 'takeOut', orderStatus: 'proceeding'};
    const orderId = batch.add(ordersRef, orderData);
    orderIdList.push(orderId);
  }
  ///////////////////////////////////////////////////////////////////////////
  for (const orderId of orderIdList) {
    batch.delete(`${ordersRef.path}/${orderId}`);
  }
  await batch.commit();
});
