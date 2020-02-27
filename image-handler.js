const axios = require('axios')
const Jimp = require('jimp')

const MAX_IMAGE_SIZE = 600

const QUALITY = 80

/**
* Downloads an image and deletes it's link from the object.
*
* @param 	{array} events An array of events.
* @return 	{array} events An array of events with base64 encoded images.
*/
module.exports = handleImage = async events => {

	return await Promise.all( events.map( async event => {

		event.image = await get(event.imageLink)
		
		delete event.imageLink 

		return event
	}))

}

/**
* Downloads and processes an image.
*
* @param  {string} url Url of the image.
* @return {string} 	   Base64 encoded image.	
*/
const get = async url => {

	/* Get image as a buffer */
	
	const response = await axios.get(url, { responseType: 'arraybuffer'})

	const image = await Jimp.read(response.data)

	/* Fit the image into MAX_IMAGE_SIZE */
	if (image.bitmap.width > MAX_IMAGE_SIZE || image.bitmap.height > MAX_IMAGE_SIZE)
    	image.scaleToFit(MAX_IMAGE_SIZE, MAX_IMAGE_SIZE)

    /* Compress the image */
    image.quality(QUALITY)

    const buffer = await image.getBufferAsync(Jimp.MIME_JPEG)

	return Buffer.from(buffer, 'binary').toString('base64')
}