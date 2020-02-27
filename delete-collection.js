// See https://firebase.google.com/docs/firestore/manage-data/delete-data

module.exports = deleteCollection = (db) => {
  let collectionRef = db.collection('events');
  let query = collectionRef.orderBy('__name__').limit(5);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, 5, resolve, reject);
  });
}

const deleteQueryBatch = (db, query, batchSize, resolve, reject) =>{
  query.get()
    .then((snapshot) => {
      // When there are no documents left, we are done
      if (snapshot.size === 0) {
        return 0;
      }

      // Delete documents in a batch
      let batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      return batch.commit().then(() => {
        return snapshot.size;
      });
    }).then((numDeleted) => {
      if (numDeleted === 0) {
        resolve();
        return;
      }

      // Recurse on the next process tick, to avoid
      // exploding the stack.
      return process.nextTick(() => {
        deleteQueryBatch(db, query, batchSize, resolve, reject);
      });
    })
    .catch(reject);
}