/**
 * MezoMenu - Environment Types for Cloudflare Workers
 * Define all environment bindings and types
 */

// ========================================
// R2 Bindings
// ========================================

interface R2Bucket {
    put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null, options?: R2PutOptions): Promise<R2Object>;
    get(key: string): Promise<R2Object | null>;
    head(key: string): Promise<R2ObjectHead | null>;
    delete(key: string): Promise<boolean>;
    list(options?: R2ListOptions): Promise<R2Objects>;
}

interface R2PutOptions {
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
    md5?: string;
}

interface R2HTTPMetadata {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheExpiry?: Date | number;
    cacheTTL?: number;
}

interface R2Object {
    key: string;
    version: string;
    size: number;
    etag: string;
    httpEtag: string;
    uploaded: Date;
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
    range?: { offset: number; length: number };
    writeHttpMetadata(headers: Headers): void;
    body: ReadableStream | null;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    json(): Promise<any>;
}

interface R2ObjectHead {
    key: string;
    version: string;
    size: number;
    etag: string;
    httpEtag: string;
    uploaded: Date;
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
}

interface R2Objects {
    objects: R2Object[];
    truncated: boolean;
    cursor?: string;
    delimitedPrefixes: string[];
    listTruncated(): boolean;
}

interface R2ListOptions {
    prefix?: string;
    delimiter?: string;
    cursor?: string;
    limit?: number;
    startAfter?: string;
    include?: Array<'httpMetadata' | 'customMetadata'>;
}

// ========================================
// KV Namespace
// ========================================

interface KVNamespace {
    get(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any>;
    put(key: string, value: string | ReadableStream | ArrayBuffer, options?: KVOptions): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: KVListOptions): Promise<KVListResult>;
    getWithMetadata(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<KVEntry>;
}

interface KVOptions {
    expiration?: number;
    expirationTtl?: number;
    metadata?: any;
}

interface KVListOptions {
    prefix?: string;
    limit?: number;
    cursor?: string;
}

interface KVListResult {
    keys: KVKey[];
    list_complete: boolean;
    cursor?: string;
}

interface KVKey {
    name: string;
    expiration?: number;
    metadata?: any;
}

interface KVEntry<T = any> {
    value: T;
    metadata?: any;
}

// ========================================
// D1 Database
// ========================================

interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
    exec(query: string): Promise<D1ExecResult>;
    dump(): Promise<ArrayBuffer>;
}

interface D1PreparedStatement {
    bind(...params: any[]): D1PreparedStatement;
    first<T = any>(colName?: string): Promise<T | null>;
    all<T = Record<string, any>[]>(): Promise<{ results: T[]; success: boolean; meta: object }>();
    run(): Promise<D1Result>;
}

interface D1Result {
    results: any[];
    success: boolean;
    meta: {
        changed_db: boolean;
        changes: number;
        last_row_id: number;
        duration: number;
        rows_read: number;
        rows_written: number;
        size_after: number;
    };
}

interface D1ExecResult {
    count: number;
    duration: number;
}

// ========================================
// Main Environment Interface
// ========================================

export interface Env {
    // Environment Variables
    ENVIRONMENT?: string;
    APP_NAME?: string;
    APP_URL?: string;
    
    // Firebase Configuration
    FIREBASE_API_KEY?: string;
    FIREBASE_PROJECT_ID?: string;
    FIREBASE_AUTH_DOMAIN?: string;
    FIREBASE_DATABASE_URL?: string;
    
    // NVIDIA AI
    NVIDIA_API_KEY?: string;
    
    // JWT Authentication
    JWT_SECRET?: string;
    
    // WhatsApp Integration
    WHATSAPP_BUSINESS_PHONE_NUMBER?: string;
    WHATSAPP_API_TOKEN?: string;
    WHATSAPP_API_URL?: string;
    
    // R2 Storage Bindings
    R2_IMAGES?: R2Bucket;
    ASSETS?: R2Bucket;
    
    // KV Namespace (for caching)
    CACHE?: KVNamespace;
    AUTH_CACHE?: KVNamespace;
    
    // D1 Database (alternative to Firebase)
    DB?: D1Database;
}

// ========================================
// Request Context Types
// ========================================

export interface AuthenticatedRequest extends Request {
    user?: UserInfo;
}

export interface UserInfo {
    uid: string;
    email: string;
    restaurantId: string;
    role: 'owner' | 'admin' | 'staff';
    restaurantName?: string;
    plan?: 'free' | 'pro' | 'enterprise';
}

export interface RestaurantInfo {
    id: string;
    name: string;
    slug: string;
    logo?: string;
    description?: string;
    cuisineType?: string;
    address?: string;
    city?: string;
    whatsappNumber?: string;
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'suspended';
    createdAt: number;
    updatedAt: number;
}

export interface MenuItem {
    id: string;
    restaurantId: string;
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    originalPrice?: number;
    image?: string;
    emoji?: string;
    available: boolean;
    popular?: boolean;
    orderCount: number;
    position: number;
    createdAt: number;
    updatedAt: number;
}

export interface Category {
    id: string;
    restaurantId: string;
    name: string;
    emoji?: string;
    icon?: string;
    position: number;
    itemCount: number;
    createdAt: number;
}

export interface Order {
    id: string;
    restaurantId: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress?: string;
    items: OrderItem[];
    subtotal: number;
    deliveryFee: number;
    total: number;
    notes?: string;
    status: 'new' | 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
    paymentMethod: 'whatsapp' | 'cash' | 'card';
    whatsappMessageId?: string;
    createdAt: number;
    updatedAt: number;
}

export interface OrderItem {
    itemId: string;
    name: string;
    price: number;
    quantity: number;
    notes?: string;
}

// ========================================
// API Response Types
// ========================================

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: number;
    path?: string;
    method?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
}

// ========================================
// Error Types
// ========================================

export class ApiError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public code?: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export class ValidationError extends ApiError {
    constructor(message: string, public fields?: string[]) {
        super(400, message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}

export class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized') {
        super(401, message, 'UNAUTHORIZED');
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden') {
        super(403, message, 'FORBIDDEN');
        this.name = 'ForbiddenError';
    }
}

export class NotFoundError extends ApiError {
    constructor(resource = 'Resource') {
        super(404, `${resource} not found`, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}
