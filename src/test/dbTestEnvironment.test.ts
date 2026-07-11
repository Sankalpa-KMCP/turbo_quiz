import { describe, it, expect } from 'vitest'

describe('IndexedDB Test Environment', () => {
  it('should support opening, upgrading, writing, reading, and deleting a database', () => {
    return new Promise<void>((resolve, reject) => {
      const dbName = `test-db-${Date.now()}-${Math.random()}`
      const request = indexedDB.open(dbName, 1)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        db.createObjectStore('keyval')
      }

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Write a test value
        const transaction = db.transaction('keyval', 'readwrite')
        const store = transaction.objectStore('keyval')
        const putRequest = store.put('bar', 'foo')

        putRequest.onsuccess = () => {
          // Read the test value
          const getTransaction = db.transaction('keyval', 'readonly')
          const getStore = getTransaction.objectStore('keyval')
          const getRequest = getStore.get('foo')

          getRequest.onsuccess = () => {
            expect(getRequest.result).toBe('bar')

            // Close database connection
            db.close()

            // Delete the database to clean up
            const deleteRequest = indexedDB.deleteDatabase(dbName)
            deleteRequest.onsuccess = () => {
              resolve()
            }
            deleteRequest.onerror = () => {
              reject(new Error('Failed to delete test database'))
            }
          }

          getRequest.onerror = () => {
            db.close()
            indexedDB.deleteDatabase(dbName)
            reject(getRequest.error)
          }
        }

        putRequest.onerror = () => {
          db.close()
          indexedDB.deleteDatabase(dbName)
          reject(putRequest.error)
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  })
})
