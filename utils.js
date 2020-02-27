const asyncForEach = async (array, callback) => {
	 /* eslint-disable no-await-in-loop */
  	for (let index = 0; index < array.length; index++) 
  		await callback(array[index], index, array)
  	/* eslint-enable no-await-in-loop */
}

module.exports = {
	asyncForEach
}