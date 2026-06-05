const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const TABLE_NAME = process.env.SUPABASE_RECORDS_TABLE || "school_records";

let cachedClient = null;

function getSupabase() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in backend/.env");
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

function createId() {
  return crypto.randomUUID();
}

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeComparable(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const date = Date.parse(value);
    if (!Number.isNaN(date) && /^\d{4}-\d{2}-\d{2}/.test(value)) return date;
  }
  return value;
}

function getPathValue(obj, path) {
  return String(path)
    .split(".")
    .reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

function setPathValue(obj, path, value) {
  const parts = String(path).split(".");
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function unsetPathValue(obj, path) {
  const parts = String(path).split(".");
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    cursor = cursor?.[parts[i]];
    if (!cursor) return;
  }
  delete cursor[parts[parts.length - 1]];
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function valuesEqual(left, right) {
  const comparableLeft = normalizeComparable(left);
  const comparableRight = normalizeComparable(right);
  if (typeof comparableLeft === "number" && typeof comparableRight === "number") {
    return comparableLeft === comparableRight;
  }
  return String(left) === String(right);
}

function matchesOperator(actual, operator, expected) {
  if (operator === "$exists") return expected ? actual !== undefined : actual === undefined;
  if (operator === "$in") return (expected || []).some((item) => valuesEqual(actual, item));
  if (operator === "$nin") return !(expected || []).some((item) => valuesEqual(actual, item));
  if (operator === "$ne") return !valuesEqual(actual, expected);

  const left = normalizeComparable(actual);
  const right = normalizeComparable(expected);
  if (operator === "$gte") return left >= right;
  if (operator === "$gt") return left > right;
  if (operator === "$lte") return left <= right;
  if (operator === "$lt") return left < right;

  return false;
}

function matchesValue(actual, expected) {
  if (expected instanceof RegExp) return expected.test(String(actual || ""));

  if (isPlainObject(expected)) {
    const operators = Object.keys(expected).filter((key) => key.startsWith("$"));
    if (operators.length) {
      return operators.every((operator) => matchesOperator(actual, operator, expected[operator]));
    }
  }

  return valuesEqual(actual, expected);
}

function matchesQuery(doc, query = {}) {
  if (!query || Object.keys(query).length === 0) return true;

  return Object.entries(query).every(([key, expected]) => {
    if (key === "$or") return expected.some((item) => matchesQuery(doc, item));
    if (key === "$and") return expected.every((item) => matchesQuery(doc, item));

    const actual = key === "_id" ? doc._id : getPathValue(doc, key);
    return matchesValue(actual, expected);
  });
}

function sortDocs(docs, sortSpec = {}) {
  const entries = Object.entries(sortSpec || {});
  if (!entries.length) return docs;

  return [...docs].sort((a, b) => {
    for (const [field, direction] of entries) {
      const av = normalizeComparable(getPathValue(a, field));
      const bv = normalizeComparable(getPathValue(b, field));
      if (av == null && bv != null) return direction === -1 ? 1 : -1;
      if (av != null && bv == null) return direction === -1 ? -1 : 1;
      if (av > bv) return direction === -1 ? -1 : 1;
      if (av < bv) return direction === -1 ? 1 : -1;
    }
    return 0;
  });
}

function parseSelect(selectSpec) {
  if (!selectSpec) return null;
  const fields = String(selectSpec).split(/\s+/).filter(Boolean);
  const exclude = fields.filter((field) => field.startsWith("-")).map((field) => field.slice(1));
  const include = fields.filter((field) => !field.startsWith("-") && !field.startsWith("+"));
  return { include, exclude };
}

function applySelect(doc, selectSpec) {
  const parsed = parseSelect(selectSpec);
  if (!parsed) return doc;

  if (parsed.include.length) {
    const selected = { _id: doc._id, id: doc.id };
    for (const field of parsed.include) {
      const value = getPathValue(doc, field);
      if (value !== undefined) setPathValue(selected, field, value);
    }
    return selected;
  }

  const next = clone(doc);
  for (const field of parsed.exclude) unsetPathValue(next, field);
  return next;
}

function attachArrayHelpers(value) {
  if (Array.isArray(value)) {
    for (const item of value) attachArrayHelpers(item);
    if (!Object.prototype.hasOwnProperty.call(value, "id")) {
      Object.defineProperty(value, "id", {
        enumerable: false,
        value(id) {
          return this.find((item) => valuesEqual(item?._id || item?.id, id));
        },
      });
    }
    return value;
  }

  if (isPlainObject(value)) {
    for (const item of Object.values(value)) attachArrayHelpers(item);
  }

  return value;
}

function ensureSubdocumentIds(value) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (isPlainObject(item) && !item._id && !item.id) item._id = createId();
      ensureSubdocumentIds(item);
    });
    return value;
  }

  if (isPlainObject(value)) {
    for (const item of Object.values(value)) ensureSubdocumentIds(item);
  }

  return value;
}

function rowToDoc(row) {
  const payload = clone(row.payload || {});
  const createdAt = payload.createdAt || row.created_at;
  const updatedAt = payload.updatedAt || row.updated_at;
  const doc = {
    ...payload,
    _id: row.id,
    id: row.id,
    createdAt,
    updatedAt,
  };
  return attachArrayHelpers(doc);
}

function docToPayload(doc) {
  const payload = clone(doc || {});
  delete payload.id;
  delete payload._id;
  ensureSubdocumentIds(payload);
  return payload;
}

function applyUpdate(doc, update = {}, isInsert = false) {
  const next = clone(doc || {});

  if (update.$set) {
    Object.entries(update.$set).forEach(([key, value]) => setPathValue(next, key, value));
  }

  if (isInsert && update.$setOnInsert) {
    Object.entries(update.$setOnInsert).forEach(([key, value]) => setPathValue(next, key, value));
  }

  if (update.$addToSet) {
    Object.entries(update.$addToSet).forEach(([key, value]) => {
      const arr = getPathValue(next, key) || [];
      const items = value?.$each || [value];
      for (const item of items) {
        if (!arr.some((existing) => valuesEqual(existing, item))) arr.push(item);
      }
      setPathValue(next, key, arr);
    });
  }

  if (update.$pull) {
    Object.entries(update.$pull).forEach(([key, condition]) => {
      const arr = getPathValue(next, key) || [];
      const filtered = arr.filter((item) => !matchesQuery(item, condition));
      setPathValue(next, key, filtered);
    });
  }

  if (update.$unset) {
    Object.keys(update.$unset).forEach((key) => unsetPathValue(next, key));
  }

  const hasOperators = Object.keys(update).some((key) => key.startsWith("$"));
  if (!hasOperators) Object.assign(next, clone(update));

  return next;
}

async function fetchCollection(collection) {
  const { data, error } = await getSupabase()
    .from(TABLE_NAME)
    .select("*")
    .eq("collection", collection);

  if (error) throw error;
  return (data || []).map(rowToDoc);
}

async function upsertDocument(collection, doc) {
  const id = doc._id || doc.id || createId();
  const now = new Date().toISOString();
  const payload = docToPayload({ ...doc, updatedAt: now });

  if (!doc.createdAt) payload.createdAt = now;
  payload.updatedAt = now;

  const { data, error } = await getSupabase()
    .from(TABLE_NAME)
    .upsert(
      {
        id,
        collection,
        payload,
        updated_at: now,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return rowToDoc(data);
}

async function deleteById(collection, id) {
  const doc = await findById(collection, id);
  if (!doc) return null;
  const { error } = await getSupabase().from(TABLE_NAME).delete().eq("id", id).eq("collection", collection);
  if (error) throw error;
  return doc;
}

async function findById(collection, id) {
  const { data, error } = await getSupabase()
    .from(TABLE_NAME)
    .select("*")
    .eq("collection", collection)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToDoc(data) : null;
}

class SupabaseQuery {
  constructor(model, query = {}, single = false) {
    this.model = model;
    this.query = query || {};
    this.single = single;
    this.sortSpec = null;
    this.limitValue = null;
    this.selectSpec = null;
    this.leanMode = false;
    this.populateSpecs = [];
  }

  sort(spec) {
    this.sortSpec = spec;
    return this;
  }

  limit(value) {
    this.limitValue = Number(value) || null;
    return this;
  }

  select(spec) {
    this.selectSpec = spec;
    return this;
  }

  lean() {
    this.leanMode = true;
    return this;
  }

  populate(path, select) {
    this.populateSpecs.push({ path, select });
    return this;
  }

  async exec() {
    let docs = await this.model._findRaw(this.query);
    if (this.sortSpec) docs = sortDocs(docs, this.sortSpec);
    if (this.limitValue) docs = docs.slice(0, this.limitValue);
    if (this.populateSpecs.length) {
      for (const spec of this.populateSpecs) {
        docs = await Promise.all(docs.map((doc) => populatePath(doc, spec.path, spec.select)));
      }
    }
    docs = docs.map((doc) => applySelect(doc, this.selectSpec));

    if (this.single) {
      const one = docs[0] || null;
      return one && !this.leanMode ? this.model._hydrate(one) : one;
    }

    return this.leanMode ? docs : docs.map((doc) => this.model._hydrate(doc));
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

class SupabaseResultQuery {
  constructor(model, promise) {
    this.model = model;
    this.promise = promise;
    this.leanMode = false;
    this.selectSpec = null;
    this.populateSpecs = [];
  }

  lean() {
    this.leanMode = true;
    return this;
  }

  select(spec) {
    this.selectSpec = spec;
    return this;
  }

  populate(path, select) {
    this.populateSpecs.push({ path, select });
    return this;
  }

  async exec() {
    let doc = await this.promise;
    if (!doc) return null;

    doc = typeof doc.toObject === "function" ? doc.toObject() : clone(doc);

    if (this.populateSpecs.length) {
      for (const spec of this.populateSpecs) {
        doc = await populatePath(doc, spec.path, spec.select);
      }
    }

    doc = applySelect(doc, this.selectSpec);
    return this.leanMode ? doc : this.model._hydrate(doc);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

const POPULATE_COLLECTIONS = {
  actor: "users",
  classId: "classes",
  createdBy: "users",
  reviewedBy: "users",
  student: "students",
  studentId: "students",
  teacherId: "users",
  updatedBy: "users",
  userId: "users",
};

async function populatePath(doc, path, select) {
  const next = clone(doc);
  const parts = String(path).split(".");

  async function populateAt(cursor, index) {
    if (cursor == null) return;
    const key = parts[index];
    if (index === parts.length - 1) {
      if (Array.isArray(cursor)) {
        await Promise.all(cursor.map((item) => populateAt(item, index)));
        return;
      }
      const id = cursor[key];
      if (!id || typeof id === "object") return;
      const collection = POPULATE_COLLECTIONS[key] || POPULATE_COLLECTIONS[path];
      if (!collection) return;
      const populated = await findById(collection, id);
      if (populated) cursor[key] = applySelect(populated, select);
      return;
    }

    const value = cursor[key];
    if (Array.isArray(value)) {
      await Promise.all(value.map((item) => populateAt(item, index + 1)));
    } else {
      await populateAt(value, index + 1);
    }
  }

  await populateAt(next, 0);
  return next;
}

function createModel(collection, options = {}) {
  class SupabaseDocument {
    constructor(data = {}) {
      Object.assign(this, clone(data));
      if (this.id && !this._id) this._id = this.id;
      attachArrayHelpers(this);
    }

    async save() {
      const plain = this.toObject();
      if (options.beforeSave) await options.beforeSave(plain, this);
      const saved = await upsertDocument(collection, plain);
      Object.assign(this, saved);
      attachArrayHelpers(this);
      return this;
    }

    toObject() {
      return clone({ ...this });
    }

    toJSON() {
      return this.toObject();
    }

    async deleteOne() {
      if (!this._id) return { deletedCount: 0 };
      await deleteById(collection, this._id);
      return { deletedCount: 1 };
    }
  }

  SupabaseDocument.collectionName = collection;

  SupabaseDocument._hydrate = (doc) => {
    const instance = new SupabaseDocument(doc);
    if (options.methods) Object.assign(instance, options.methods);
    return instance;
  };

  SupabaseDocument._findRaw = async (query = {}) => {
    const docs = await fetchCollection(collection);
    return docs.filter((doc) => matchesQuery(doc, query));
  };

  SupabaseDocument.find = (query = {}) => new SupabaseQuery(SupabaseDocument, query, false);
  SupabaseDocument.findOne = (query = {}) => new SupabaseQuery(SupabaseDocument, query, true);
  SupabaseDocument.findById = (id) => new SupabaseQuery(SupabaseDocument, { _id: id }, true);

  SupabaseDocument.create = async (data) => {
    const doc = new SupabaseDocument(data);
    await doc.save();
    return doc;
  };

  SupabaseDocument.insertMany = async (items = []) => Promise.all(items.map((item) => SupabaseDocument.create(item)));

  SupabaseDocument.countDocuments = async (query = {}) => {
    const docs = await SupabaseDocument._findRaw(query);
    return docs.length;
  };

  SupabaseDocument.distinct = async (field, query = {}) => {
    const docs = await SupabaseDocument._findRaw(query);
    return [...new Set(docs.map((doc) => getPathValue(doc, field)).filter((value) => value !== undefined && value !== null))];
  };

  SupabaseDocument.findByIdAndUpdate = (id, update, opts = {}) => new SupabaseResultQuery(SupabaseDocument, (async () => {
    const existing = await findById(collection, id);
    if (!existing && !opts.upsert) return null;
    const next = applyUpdate(existing || { _id: id }, update, !existing);
    next._id = id;
    const saved = await upsertDocument(collection, next);
    return SupabaseDocument._hydrate(saved);
  })());

  SupabaseDocument.findOneAndUpdate = (query, update, opts = {}) => new SupabaseResultQuery(SupabaseDocument, (async () => {
    const existing = (await SupabaseDocument._findRaw(query))[0];
    if (!existing && !opts.upsert) return null;
    const next = applyUpdate(existing || {}, update, !existing);
    if (existing?._id) next._id = existing._id;
    const saved = await upsertDocument(collection, next);
    return SupabaseDocument._hydrate(saved);
  })());

  SupabaseDocument.findByIdAndDelete = (id) => new SupabaseResultQuery(SupabaseDocument, (async () => {
    const deleted = await deleteById(collection, id);
    return deleted ? SupabaseDocument._hydrate(deleted) : null;
  })());

  SupabaseDocument.findOneAndDelete = (query) => new SupabaseResultQuery(SupabaseDocument, (async () => {
    const existing = (await SupabaseDocument._findRaw(query))[0];
    if (!existing) return null;
    const deleted = await deleteById(collection, existing._id);
    return deleted ? SupabaseDocument._hydrate(deleted) : null;
  })());

  SupabaseDocument.deleteOne = async (query) => {
    const existing = (await SupabaseDocument._findRaw(query))[0];
    if (!existing) return { deletedCount: 0 };
    await deleteById(collection, existing._id);
    return { deletedCount: 1 };
  };

  SupabaseDocument.deleteMany = async (query) => {
    const docs = await SupabaseDocument._findRaw(query);
    await Promise.all(docs.map((doc) => deleteById(collection, doc._id)));
    return { deletedCount: docs.length };
  };

  SupabaseDocument.updateMany = async (query, update) => {
    const docs = await SupabaseDocument._findRaw(query);
    await Promise.all(
      docs.map((doc) => {
        const next = applyUpdate(doc, update);
        next._id = doc._id;
        return upsertDocument(collection, next);
      })
    );
    return { matchedCount: docs.length, modifiedCount: docs.length };
  };

  SupabaseDocument.bulkWrite = async (ops = []) => {
    let modifiedCount = 0;
    let upsertedCount = 0;

    for (const op of ops) {
      if (!op.updateOne) continue;
      const { filter, update, upsert } = op.updateOne;
      const existing = (await SupabaseDocument._findRaw(filter))[0];
      if (!existing && !upsert) continue;
      const next = applyUpdate(existing || {}, update, !existing);
      if (existing?._id) next._id = existing._id;
      await upsertDocument(collection, next);
      if (existing) modifiedCount += 1;
      else upsertedCount += 1;
    }

    return { modifiedCount, upsertedCount };
  };

  SupabaseDocument.aggregate = async (pipeline = []) => {
    let docs = await SupabaseDocument._findRaw({});
    for (const step of pipeline) {
      if (step.$match) docs = docs.filter((doc) => matchesQuery(doc, step.$match));
      if (step.$group && step.$group._id === "$module") {
        const groups = new Map();
        for (const doc of docs) {
          const key = doc.module;
          const group = groups.get(key) || { _id: key, count: 0, pending: 0 };
          group.count += 1;
          if (/pending/i.test(String(doc.status || ""))) group.pending += 1;
          groups.set(key, group);
        }
        docs = [...groups.values()];
      }
    }
    return docs;
  };

  return SupabaseDocument;
}

async function hashUserPasswordIfNeeded(data) {
  if (data.email) data.email = String(data.email).toLowerCase().trim();
  if (data.username) data.username = String(data.username).toLowerCase().trim();
  if (data.password && !String(data.password).startsWith("$2")) {
    data.password = await bcrypt.hash(data.password, 12);
  }
}

module.exports = {
  createModel,
  getSupabase,
  hashUserPasswordIfNeeded,
};
