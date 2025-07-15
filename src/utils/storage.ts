import browser from "webextension-polyfill";

/**
 * Save data to local or sync storage
 * @param key The key to save the data under
 * @param data The data to save
 * @param storageType Which storage type to use - local is faster, sync persists across devices
 * @returns A promise that resolves when the data is saved
 */
export const saveToStorage = async <T>(
    key: string,
    data: T,
    storageType: 'local' | 'sync' = 'local'
): Promise<void> => {
    try {
        const serializedData = JSON.stringify(data);
        const sizeInBytes = new TextEncoder().encode(serializedData).length;
        const STORAGE_LIMIT = storageType === 'sync' ? 8192 : 5242880; // 8KB for sync, 5MB for local

        if (sizeInBytes > STORAGE_LIMIT) {
            throw new Error(`Data for key ${key} exceeds storage limit: ${sizeInBytes} bytes > ${STORAGE_LIMIT} bytes`);
        }

        await browser.storage[storageType].set({ [key]: data });
        return Promise.resolve();
    } catch (error) {
        console.error(`Failed to save data to ${storageType} storage:`, error);
        if (storageType === 'sync') {
            // If sync fails, try to save to local
            try {
                await browser.storage.local.set({ [key]: data });
                return Promise.resolve();
            } catch (localError) {
                return Promise.reject(localError);
            }
        }
        return Promise.reject(error);
    }
};

/**
 * Load data from storage
 * @param key The key to load
 * @param defaultValue The default value to return if the key doesn't exist
 * @param storageTypes Which storage types to try, in order of preference
 * @returns The loaded data or the default value
 */
export const loadFromStorage = async <T>(
    key: string,
    defaultValue: T,
    storageTypes: Array<'local' | 'sync'> = ['local', 'sync']
): Promise<T> => {
    for (const storageType of storageTypes) {
        try {
            const result = await browser.storage[storageType].get(key);
            if (result[key] !== undefined) {
                return result[key] as T;
            }
        } catch (error) {
            console.error(`Failed to load data from ${storageType} storage:`, error);
            // Continue to next storage type
        }
    }

    return defaultValue;
};

/**
 * Remove data from storage
 * @param keys The keys to remove
 * @param storageType Which storage type to remove from
 * @returns A promise that resolves when the data is removed
 */
export const removeFromStorage = async (
    keys: string | string[],
    storageType: 'local' | 'sync' = 'local'
): Promise<void> => {
    try {
        await browser.storage[storageType].remove(keys);
        return Promise.resolve();
    } catch (error) {
        console.error(`Failed to remove keys from ${storageType} storage:`, error);
        return Promise.reject(error);
    }
};

/**
 * Clear all data from storage
 * @param storageType Which storage type to clear
 * @returns A promise that resolves when the storage is cleared
 */
export const clearStorage = async (
    storageType: 'local' | 'sync' | 'both' = 'both'
): Promise<void> => {
    try {
        if (storageType === 'both' || storageType === 'local') {
            await browser.storage.local.clear();
        }

        if (storageType === 'both' || storageType === 'sync') {
            await browser.storage.sync.clear();
        }

        return Promise.resolve();
    } catch (error) {
        console.error(`Failed to clear ${storageType} storage:`, error);
        return Promise.reject(error);
    }
};

/**
 * Save multiple key-value pairs to storage
 * @param data An object containing key-value pairs to save
 * @param storageType Which storage type to use
 * @returns A promise that resolves when all data is saved
 */
export const saveMultipleToStorage = async (
    data: Record<string, any>,
    storageType: 'local' | 'sync' = 'local'
): Promise<void> => {
    try {
        await browser.storage[storageType].set(data);
        return Promise.resolve();
    } catch (error) {
        console.error(`Failed to save multiple items to ${storageType} storage:`, error);
        if (storageType === 'sync') {
            // If sync fails, try to save to local
            try {
                await browser.storage.local.set(data);
                return Promise.resolve();
            } catch (localError) {
                return Promise.reject(localError);
            }
        }
        return Promise.reject(error);
    }
};

/**
 * Get all data from storage
 * @param storageType Which storage type to get from
 * @returns A promise that resolves with all data in the storage
 */
export const getAllFromStorage = async (
    storageType: 'local' | 'sync' = 'local'
): Promise<Record<string, any>> => {
    try {
        return await browser.storage[storageType].get(null);
    } catch (error) {
        console.error(`Failed to get all data from ${storageType} storage:`, error);
        return Promise.reject(error);
    }
};

/**
 * Save data to both local and sync storage
 * @param key The key to save the data under
 * @param data The data to save
 * @returns A promise that resolves when the data is saved to both storage types
 */
export const saveToBothStorages = async <T>(
    key: string,
    data: T
): Promise<void> => {
    try {
        // Save to local storage first
        await saveToStorage(key, data, 'local');

        // Then attempt to save to sync storage
        try {
            await saveToStorage(key, data, 'sync');
        } catch (syncError) {
            console.warn("Failed to sync to remote storage:", syncError);
            // We don't consider this a full failure since local save succeeded
        }

        return Promise.resolve();
    } catch (error) {
        return Promise.reject(error);
    }
};

/**
 * Get the size of data in bytes when serialized to JSON
 * @param data The data to check size of
 * @returns The size in bytes
 */
export const getDataSizeInBytes = <T>(data: T): number => {
    const serializedData = JSON.stringify(data);
    return new TextEncoder().encode(serializedData).length;
};

/**
 * Check if storage has enough space for the given data
 * @param data The data to check
 * @param storageType Which storage type to check
 * @returns True if there is enough space, false otherwise
 */
export const hasEnoughStorageSpace = <T>(
    data: T,
    storageType: 'local' | 'sync' = 'local'
): boolean => {
    const sizeInBytes = getDataSizeInBytes(data);
    const STORAGE_LIMIT = storageType === 'sync' ? 8192 : 5242880; // 8KB for sync, 5MB for local
    return sizeInBytes <= STORAGE_LIMIT;
};
