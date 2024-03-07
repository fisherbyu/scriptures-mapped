/*========================================================================
 * FILE:    Scriptures.js
 * AUTHOR:  Andrew Fisher
 * DATE:    Winter 2024
 *
 * DESCRIPTION: JavaScript Module to manage navigation using hash changes.
 */

/*-----------------------------------------------------------------------
 *                      IMPORTS
 */

/*------------------------------------------------------------------------
 *                      CONSTANTS
 */

/*------------------------------------------------------------------------
 *                      PRIVATE HELPERS
 */
const ajax = function(url, successCallback, failureCallback, skipJsonParse) {
    let request = new XMLHttpRequest();

    request.open('GET', url, true);

    request.onload = function() {
        if(request.status >= 200  && request.status < 400){
            let data = request.responseText
            if (skipJsonParse !== true) {
                data = JSON.parse(data);
            }
            

            if(typeof successCallback === "function") {
                successCallback(data);
            }
        }
        else {
            if(typeof failureCallback === "function") {
                failureCallback(request);
            }            
        }
    };
    request.onerror = failureCallback;
    request.send();
};

const cacheBooks = function(callback){
    volumes.forEach (volume => {
        let volumeBooks = [];
        let bookId = volume.minBookId;

        while(bookId <= volume.maxBookId){
            volumeBooks.push(books[bookId]);
            bookId += 1;
        }
        volume.books = volumeBooks;
    });

    if(typeof callback === "function"){
        callback();
    }
};

const encodedScripturesURL = function(bookId, chapter, verses, isJst) {
    if (bookId != undefined && chapter != undefined) {
        let options = "";

        if (verses !== undefined) {
            options += verses;
        }
        if (isJst !== undefined) {
            options += "&jst=JST";
        }
        const scripURL = `${URL_SCRIPTURES}?book=${bookId}&chap=${chapter}&verses${options}`;
        return scripURL
    }
}


/*------------------------------------------------------------------------
 *                      EXPORTED FUNCTIONS
 */
const init = function(readyListener) {
    let booksLoaded = false;
    let volumesLoaded = false;
    
    ajax("https://scriptures.byu.edu/mapscrip/model/books.php",
        data  => {
            books = data;
            booksLoaded = true;

            if(volumesLoaded) {
                cacheBooks(readyListener);
            }
        }
    )
    ajax("https://scriptures.byu.edu/mapscrip/model/volumes.php",
    data  => {
            volumes = data;
            volumesLoaded = true;

            if(booksLoaded) {
                cacheBooks(readyListener);
            }
        }
    )

    if (booksLoaded) {
        console.log(books)
    }
    onHashChanged()
};

/*-----------------------------------------------------------------------
 *                      EXPORTS
 */
