import {FirebaseOptions, initializeApp} from 'firebase/app';
import {getAuth, signInWithEmailAndPassword} from 'firebase/auth';
import {
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentData,
  DocumentReference,
  FieldPath,
  FirestoreDataConverter,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  initializeFirestore,
  limit,
  orderBy,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  QuerySnapshot,
  serverTimestamp,
  setDoc,
  SnapshotOptions,
  Timestamp,
  updateDoc,
  where,
  WhereFilterOp,
  WriteBatch,
  writeBatch,
} from 'firebase/firestore';

type ColRefOrPath = CollectionReference | string | string[];
type DocRefOrPath = DocumentReference | string | string[];

export class Fire {
  /**
   * @example
   * const options = {
   *   // your firebase project options here...
   * };
   * Fire.init(options);
   * @see getOptionsFromViteEnv
   */
  static initialize(options: FirebaseOptions, name?: string) {
    const app = initializeApp(options, name);
    initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    });
    return app;
  }
  /**
   * @example
   * Fire.initializeFromViteEnv();
   * @see getOptionsFromViteEnv
   */
  static initializeFromViteEnv() {
    const options = Fire.getOptionsFromViteEnv();
    Fire.initialize(options);
  }
  /**
   * Returns firebase options from dotenv.
   * @example
   * // define keys below in your .env.local file.
   * // VITE_FIRE_API_KEY
   * // VITE_FIRE_AUTH_DOMAIN
   * // VITE_FIRE_PROJECT_ID
   * // VITE_FIRE_STORAGE_BUCKET
   * // VITE_FIRE_MESSAGING_SENDER_ID
   * // VITE_FIRE_APP_ID
   * // VITE_FIRE_MEASUREMENT_ID
   * // VITE_FIRE_TEST_EMAIL
   * // VITE_FIRE_TEST_PASSWORD
   * Fire.init(Fire.getOptionsFromEnv());
   * @see initialize
   */
  static getOptionsFromViteEnv(): FirebaseOptions {
    return {
      // @ts-ignore
      apiKey: import.meta.env.VITE_FIRE_API_KEY,
      // @ts-ignore
      authDomain: import.meta.env.VITE_FIRE_AUTH_DOMAIN,
      // @ts-ignore
      projectId: import.meta.env.VITE_FIRE_PROJECT_ID,
      // @ts-ignore
      storageBucket: import.meta.env.VITE_FIRE_STORAGE_BUCKET,
      // @ts-ignore
      messagingSenderId: import.meta.env.VITE_FIRE_MESSAGING_SENDER_ID,
      // @ts-ignore
      appId: import.meta.env.VITE_FIRE_APP_ID,
      // @ts-ignore
      measurementId: import.meta.env.VITE_FIRE_MEASUREMENT_ID,
    };
  }
  get auth() {
    return getAuth();
  }
  get user() {
    return this.auth.currentUser;
  }
  get uid() {
    return this.user?.uid ?? '';
  }
  async signIn(email: string, password: string) {
    await signInWithEmailAndPassword(this.auth, email, password);
    return this.user;
  }
  async signOut() {
    await this.auth.signOut();
  }
  get db() {
    return getFirestore();
  }
  serverTs() {
    return serverTimestamp();
  }
  inc(n: number) {
    return increment(n);
  }
  /**
   * @example
   * const fire = new Fire();
   * const colRefFromString = fire.colRef('stores/demo/orders');
   * const colRefFromStringArray = fire.colRef(['stores', 'demo', 'orders']);
   * const colRefFromOtherRef = fire.colRef(colRefFromString);
   */
  colRef(colRefOrPath: ColRefOrPath): CollectionReference { return getColRef(colRefOrPath); }
  /**
   * @example
   * const fire = new Fire();
   * const orderId = 'O0001';
   * const ordersRef = fire.colRef(['stores', 'demo', 'orders']);
   * const docRefFromString = fire.docRef(`stores/demo/orders/${orderId}`);
   * const docRefFromStringArray = fire.docRef(['stores', 'demo', 'orders', orderId]);
   * const docRefFromOtherRef = fire.docRef(docRefFromString);
   * // Adds new one with generated id to the collection
   * const docRefWithNewId = fire.docRef(ordersRef);
   */
  docRef(docRefOrPath: DocRefOrPath | CollectionReference): DocumentReference { return getDocRef(docRefOrPath); }
  async getDoc<T>(docRefOrPath: DocRefOrPath, converter: FirestoreDataConverter<T>): Promise<T | null> {
    const docRef = getDocRef(docRefOrPath);
    const snapshot = await getDoc(docRef.withConverter(converter));
    return snapshot.data() ?? null;
  }
  async addDoc(colRefOrPath: ColRefOrPath, data: DocumentData): Promise<DocumentReference> {
    const docRef = doc(getColRef(colRefOrPath));
    await setDoc(docRef, {...data, id: docRef.id, createdAt: this.serverTs()});
    return docRef;
  }
  async setDoc(docRefOrPath: DocRefOrPath, data: DocumentData): Promise<DocumentReference> {
    const docRef = getDocRef(docRefOrPath);
    await setDoc(docRef, {...data, id: docRef.id, createdAt: this.serverTs()});
    return docRef;
  }
  async mergeDoc(docRefOrPath: DocRefOrPath, data: DocumentData): Promise<DocumentReference> {
    const docRef = getDocRef(docRefOrPath);
    await setDoc(docRef, {...data, id: docRef.id, updatedAt: this.serverTs()}, {merge: true});
    return docRef;
  }
  async updateDoc(docRefOrPath: DocRefOrPath, data: DocumentData): Promise<DocumentReference> {
    const docRef = getDocRef(docRefOrPath);
    await updateDoc(docRef, {...data, id: docRef.id, updatedAt: this.serverTs()});
    return docRef;
  }
  async deleteDoc(docRefOrPath: DocRefOrPath): Promise<void> {
    const docRef = getDocRef(docRefOrPath);
    await deleteDoc(docRef);
  }
}

const DEF_COUNT_PER_BATCH = 495;

export class FireBatch {
  get batchCount() {
    return this.batches.length;
  }
  private totalCount: number = 0;
  private curCount: number = 0;
  private batches: WriteBatch[] = [];
  private get db() {
    return getFirestore();
  }
  private get curBatch() {
    return this.batches[this.batches.length - 1];
  }
  constructor(private countPerBatch = DEF_COUNT_PER_BATCH) {
    this.batches.push(writeBatch(this.db));
  }
  async commit(): Promise<number> {
    for (const batch of this.batches) {
      await batch.commit();
    }
    const totalCount = this.totalCount;
    this.totalCount = 0;
    this.curCount = 0;
    this.batches = [writeBatch(this.db)];
    return totalCount;
  }
  add(colRefOrPath: ColRefOrPath, data: DocumentData): string {
    const docRef = doc(getColRef(colRefOrPath));
    const docId = docRef.id;
    this.curBatch.set(docRef, {...data, id: docId, createdAt: serverTimestamp()});
    this.updateCount();
    return docId;
  }
  set(docRefOrPath: DocRefOrPath, data: DocumentData) {
    const docRef = getDocRef(docRefOrPath);
    this.curBatch.set(docRef, {...data, id: docRef.id, createdAt: serverTimestamp()});
    this.updateCount();
  }
  merge(docRefOrPath: DocRefOrPath, data: DocumentData) {
    const docRef = getDocRef(docRefOrPath);
    this.curBatch.set(docRef, {...data, id: docRef.id, updatedAt: serverTimestamp()}, {merge: true});
    this.updateCount();
  }
  update(docRefOrPath: DocRefOrPath, data: DocumentData) {
    const docRef = getDocRef(docRefOrPath);
    this.curBatch.update(docRef, {...data, id: docRef.id, updatedAt: serverTimestamp()});
    this.updateCount();
  }
  delete(docRefOrPath: DocRefOrPath) {
    const docRef = getDocRef(docRefOrPath);
    this.curBatch.delete(docRef);
    this.updateCount();
  }
  private updateCount() {
    ++this.curCount;
    ++this.totalCount;
    if (this.curCount >= this.countPerBatch) {
      this.batches.push(writeBatch(this.db));
      this.curCount = 0;
    }
  }
}

export class FireQuery<T> {
  private constraints: QueryConstraint[] = [];
  constructor(private colRefOrPath: ColRefOrPath, private converter: FirestoreDataConverter<T>) {}
  fetch(): Promise<QuerySnapshot<T>> {
    return getDocs(query(getColRef(this.colRefOrPath), ...this.constraints).withConverter(this.converter));
  }
  limit(n: number) {
    this.constraints.push(limit(n));
    return this;
  }
  asc(fieldPath: string | FieldPath) {
    this.constraints.push(orderBy(fieldPath));
    return this;
  }
  desc(fieldPath: string | FieldPath) {
    this.constraints.push(orderBy(fieldPath, 'desc'));
    return this;
  }
  where(fieldPath: string | FieldPath, opStr: WhereFilterOp, value: unknown) {
    this.constraints.push(where(fieldPath, opStr, value));
    return this;
  }
  clearConstrains() {
    this.constraints = [];
  }
}

export interface FireData {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class FireUtil {
  /**
   * Returns firestore data converter object. Timestamp values are converted to Date values.
   * @example
   * import { Fire, FireUtil } from '@woonysoft/fire';
   *
   * // Must be extended from FireData
   * interface Order extends FireData {
   *   orderType: 'dineIn' | 'takeOut';
   *   orderStatus: 'proceeding' | 'completed' | 'cancelled';
   * }
   *
   * // Creates the order data converter.
   * const orderConverter = FireUtil.createDataConverter<Order>((data) => {
   *   const {id, createdAt, updateAt, orderType, orderStatus, completedAt} = data;
   *   return {id, createdAt, updateAt, orderType, orderStatus, completedAt};
   * });
   *
   * (async () => {
   *   const fire = new Fire();
   *   // Returns Order object with the help of orderConverter.
   *   const order = await fire.getDoc(['orders', 'O00001'], orderConverter);
   *   console.log(order);
   * })();
   */
  static createDataConverter<T extends FireData>(fromFirestore: (data: FireData & DocumentData) => T): FirestoreDataConverter<T> {
    return {
      fromFirestore: (snapshot, options) => fromFirestore(FireUtil.getFireData(snapshot, options)),
      toFirestore: (modelObject) => modelObject,
    };
  }
  private static getFireData(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): FireData & DocumentData {
    const data = snapshot.data(options);
    for (const key of Object.keys(data)) {
      if (data[key] instanceof Timestamp) {
        data[key] = data[key].toDate();
      }
    }
    const {id = '', createdAt, updatedAt, ...others} = data;
    return {id, createdAt, updatedAt, ...others};
  }
}

function getColRef(colRefOrPath: ColRefOrPath): CollectionReference {
  if (typeof colRefOrPath === 'string') {
    return collection(getFirestore(), colRefOrPath);
  }
  if (Array.isArray(colRefOrPath)) {
    return collection(getFirestore(), colRefOrPath.join('/'));
  }
  return colRefOrPath;
}

function getDocRef(docRefOrPath: DocRefOrPath | CollectionReference): DocumentReference {
  if (typeof docRefOrPath === 'string') {
    return doc(getFirestore(), docRefOrPath);
  }
  if (Array.isArray(docRefOrPath)) {
    return doc(getFirestore(), docRefOrPath.join('/'));
  }
  if (docRefOrPath instanceof CollectionReference) {
    return doc(docRefOrPath);
  }
  return docRefOrPath;
}
