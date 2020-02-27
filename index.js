const functions = require("firebase-functions");
const cheerio = require("cheerio");
const dateFormat = require("dateformat");
const handleImage = require("./image-handler.js");
const axios = require("axios");
const cleanDB = require('./delete-collection.js')
const admin = require("firebase-admin");
const sizeof = require('object-sizeof')

admin.initializeApp();

exports.checkEvents = functions.region('europe-west1').https.onRequest(async (req, res) => {
	try {

		/* Get an object with the date and its properties */

		const fetch_date = getDateStamp(new Date());

		/* An instance of firestore databse */

		const db = admin.firestore();

		/* Today's database reference used to check if it exists, fetch and put events in.
		   See https://googleapis.dev/nodejs/firestore/latest/DocumentReference.html    */

		const todays_ref = db.collection(fetch_date.formatted);

		/* Checks the database for today's events */

		const document_events = await checkDatabase(todays_ref);


		if (document_events) {
			res.status(200).json({ events: document_events });
			return;
		}

		/* Get new events */
		const events = await downloadAndParse(fetch_date);

		/* Split events into chunks of 5 since firestore has a document size limit */
		const events_divided = divide(events, 5)

		res.status(200).json({ events });
		
		/* Clean old events from the database */
		//await cleanDB(db)

		/* Saving events in order not to scrape all the time */
		saveEvents(todays_ref, events_divided)
		
	} catch (err) {
		res.status(500).json({ error: `Server error: ${err}` });
	}
});


/**
* Checks if the document exists and if it does returns it's data.
*
* @see    https://googleapis.dev/nodejs/firestore/latest/CollectionReference.html
* @param  {CollectionRefence} ref Collection reference.
* @return {array} 				  Events array.
*/
const checkDatabase = async col_ref => {
	const snapshot = await col_ref.get();

	if (snapshot._size === 0) return;

	/* Map each document in collection */
	
	return snapshot.docs.map(doc => doc.data('events'))
};

/**
* Saves events to the database.
* @see   https://googleapis.dev/nodejs/firestore/latest/CollectionReference.html
* @param {CollectionRefence} ref 	Collection reference.
* @param {array} 			 events An array of events.
*/
const saveEvents = async (col_ref, events) => {

	try {

		events.forEach(chunk => 
			col_ref.doc().create({events: chunk})
		)

	} catch(err){
		console.log(`Failed to save events: ${err}`)
	}
	
}

/**
 * Downloads html from the website to be scrapped and passes it to parsing function
 * @param {string} fetch_date Formatted dd-mm-yyyy date.
 * @return {array} Events array.
 */
const downloadAndParse = async fetch_date => {

	const html = await axios.get("*", {
		headers: {
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
		}
	});

	return parseEvents(html.data, fetch_date);
};

/**
 * Processes events' data, filters old events then downloads and base64 encodes the image
 * @param {array} 	events 		Array of event objects.
 * @param {object} 	fetch_date	See getDateStamp.
 * @return {array}  			Events array.
 */
const processEvents = async (events, fetch_date) => {

	events.forEach(event => {

		/* Removing tab and new line chars */
		event.date = event.date.replace(/\t|\n/g, "");
		event.category = event.category.replace(/\t|\n/g, "");

		if (event.category.length === 0) event.category = "Other";

		/* Removing capitalization from all but the first letters of words */
		event.title = event.title.replace(
			/\w\S*/g,
			txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
		);
	});

	/* Filtering old events */
	events = events.filter(event => {

		const date_arr = event.date.split("-");

		const len = date_arr.length;

		/* If event is in the future year */
		if (fetch_date.year < parseInt(date_arr[len - 3])) return true;

		/* If event is next month */
		if (
			fetch_date.month < parseInt(date_arr[len - 2]) &&
			fetch_date.year <= parseInt(date_arr[len - 3])
		)
			return true;

		/* If event is later or today */
		return (
			fetch_date.year <= parseInt(date_arr[len - 3]) &&
			fetch_date.month <= parseInt(date_arr[len - 2]) &&
			fetch_date.day <= parseInt(date_arr[len - 1])
		);
	});

	/* Downloading and encoding images */
	events = await handleImage(events);

	return events;
};

/**
 * Parses events from a html file
 * @see   https://cheerio.js.org	
 * @param {string} html 		 Html file string.
 * @param {object} fetch_date See getDateStamp.
 * @return {array} Events array.
 */
const parseEvents = async (html, fetch_date) => {

	const $ = cheerio.load(html);

	const events = $(".box")
		.map((i, elem) => { // Cheerio map

			const link = $(elem).find(".image");

			return {
				link: link.attr("href"),
				imageLink: $(link)
					.find("img")
					.attr("src"),
				date: $(elem)
					.find(".date")
					.text(),
				title: $(elem)
					.find(".title a")
					.text(),
				category:
					$(elem)
						.find(".category")
						.text() || "Other",
				fetch_date: fetch_date.formatted
			};
		}).get(); // Get data instead of cheerio objects

	return processEvents(events, fetch_date);
};

/**
* Returns a formatted date with day, month, year as integers.
*
* @param  {date} date A date object.
* @return {object}	An object with a formatted date with day, month, year as integers.
*/
const getDateStamp = date => ({
	formatted: dateFormat(date, "dd-mm-yyyy"),
	month: date.getMonth() + 1,
	day: date.getDate(),
	year: date.getFullYear()
});


/**
* Returns divided array.
*
* @see    https://stackoverflow.com/a/11764168
* @param  {array}  arr  An array to be divided.
* @param  {number} len  Length of a chunk.
* @return {array}  		An array of arrays.
*/
const divide = (arr, len) =>{

  var chunks = [],
      i = 0,
      n = arr.length;

  while (i < n) {
    chunks.push(arr.slice(i, i += len));
  }

  return chunks;
}

