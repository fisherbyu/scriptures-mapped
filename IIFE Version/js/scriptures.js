const Scriptures = (function () {
    "use strict";
//constants
const DIV_SCRIPTURES = "scriptures";
const REQUEST_GET = "GET";
const REQUEST_STATUS_OK = 200;
const REQUEST_STATUS_ERROR = 400;
const URL_BASE = "https://scriptures.byu.edu/mapscrip/";
const URL_BOOKS = `${URL_BASE}mapscrip/model/books.php`;
const URL_SCRIPTURES = `${URL_BASE}mapgetscrip.php`;
const URL_VOLUMES = `${URL_BASE}mapscrip/model/volumes.php`;
const MAX_ZOOM = 10


//private variables
    let books;
    let JERUSALEM = { lat: 31.7683, lng: 35.2137 };
    let mapPins = [];
    let volumes;

//private method declarations
    let addPin;
    let addNavButtons;
    let ajax;
    let bookChapterValid;
    let booksGrid;
    let booksGridContent;
    let cacheBooks;
    let clearMapPins;
    let encodedScripturesURL;
    let extractGeoplaces;
    let getScripturesFailure;
    let getScripturesSuccess;
    let getScriptures;
    let getAdjacentChapter;
    let navigateChapter;
    let navigateBook;
    let navigateHome;
    let volumesGridContent;
    let resetMap;
    let resetMapPins;
    let setCrumbs;
    let volumeTitle


// Public method declarations
    let init;
    let onHashChanged;
    let showLocation;

//private methods
    addPin = function(geoplace) {
        let pin = new markerWithLabel.MarkerWithLabel({
            position: new google.maps.LatLng(geoplace.latitude, geoplace.longitude),
            clickable: false,
            draggable: false,
            map,
            labelContent: geoplace.placename,
            labelClass: "labels",
            labelStyle: { opacity: 1.0 }
        });
        return pin
    }

    addNavButtons = function(bookId, chapter) {
        let prev = getAdjacentChapter(bookId, chapter, -1);
        let prevButton = "";
        let next = getAdjacentChapter(bookId, chapter, 1);
        let nextButton = "";
        if (prev !== undefined) {
            const volumeId = books[prev.bookId].parentBookId;
            const prevBookId = prev.bookId;
            let href = `#${volumeId}:${prevBookId}:${prev.chapter}`;
            prevButton = `<a href="${href}"><i class="material-icons">skip_previous</i></a>`
        }
        if (next !== undefined) {
            const volumeId = books[next.bookId].parentBookId;
            const nextBookId = next.bookId;
            let href = `#${volumeId}:${nextBookId}:${next.chapter}`;
            nextButton = `<a href="${href}"><i class="material-icons">skip_next</i></a>`;
        }
        const navButtonsContent = `<div class="nextprev">${prevButton}${nextButton}</div>`;

        let navHead = document.querySelector(".navheading");
        if (navHead) {
            navHead.innerHTML += navButtonsContent;
        }
    }

    ajax = function(url, successCallback, failureCallback, skipJsonParse) {
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

    bookChapterValid = function(bookId, chapter) {
        const book = books[bookId];
        if (book === undefined) {
            return false;
        }
        if (chapter == book.numChapters) {
            return true;
        }
        if (chapter >= 1 && chapter <= book.numChapters) {
            return true;
        }
        return false;
    };

    booksGrid  = function (volumeId, book) {
        let gridContent = "";
        gridContent += `<div class="volume">${volumeTitle(book)}</div>`;
        let chapterContent = ""
        for (let i = 0; i < book.numChapters; i++) {
            let chapterNumber = `${i + 1}`;
            let href = `#${volumeId}:${book.id}:${chapterNumber}`;
            chapterContent += `<a class="btn chapter" href="${href}">${chapterNumber}</a>`;
        }
        gridContent += `<div class="books">${chapterContent}</div>`
        return gridContent;
    };

    booksGridContent = function(volume) {
        let content = ""
        volume.books.forEach((book) => {
            let title = book.gridName;
            let href = `#${volume.id}:${book.id}`;
            content += `<a class="btn chapter" href="${href}">${title}</a>`;
        });

        let booksContent = `<div class="books">${content}</div>`
        return booksContent;
    }

    cacheBooks = function(callback){
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

    clearMapPins = function() {
        for (const pin of mapPins) {
            pin.setMap(null)
        }
        mapPins = [];
    }

    encodedScripturesURL = function(bookId, chapter, verses, isJst) {
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

    extractGeoplaces = function() {
        const uniqueGeoplaces = {}
        let placeLinks = document.querySelectorAll("a[onclick^='showLocation']");
        for (const placeLink of placeLinks) {
            // I got the REGEX for any commo outside a '' from ChatGPT.  This allows coordinates to be parsed correctly, even if the placename has a comma 
            const parsedItems = placeLink.getAttribute("onclick").replace(/,(?=(?:[^']*'[^']*')*[^']*$)/g, "@").split("@");  
            const latitude = Number(parsedItems[2]);
            const longitude = Number(parsedItems[3]);
            const key = `${latitude} | ${longitude}`;
            const value = {
                placename: parsedItems[1].replace(/'/g, ''),
                latitude: latitude,
                longitude: longitude,
                viewAltitude: Number(parsedItems[8])
            }
            console.log(value)
            if (uniqueGeoplaces[key] !== undefined) {
                uniqueGeoplaces[key].placename += `, ${value.placename}`
            } else {
                uniqueGeoplaces[key] = value;
            }
        }

        return uniqueGeoplaces;
    }

    getAdjacentChapter = function(bookId, chapter, increment) {
        const book = books[bookId];
        let adjacentBookId = bookId;
        let adjacentChapter = chapter + increment;

        if (adjacentChapter <= 0) {
            // Check Previous Book
            adjacentBookId -= 1;
            if (books[adjacentBookId]) {
                adjacentChapter = books[adjacentBookId].numChapters;
            } else {
                return;
            }
        } else if (adjacentChapter > book.numChapters) {
            adjacentBookId += 1;
            if (books[adjacentBookId]) {
                if (books[adjacentBookId].numChapters === 0) {
                    adjacentChapter = 0;
                } else {
                    adjacentChapter = 1;
                }
            } else {
                return;
            }
        }
        return { bookId: adjacentBookId, chapter: adjacentChapter };
    }

    getScripturesFailure = function() {
        document.getElementById(DIV_SCRIPTURES).innerHTML = 'Unable to Retrieve Chapter Contents';
    }

    getScripturesSuccess = function(chapterHTML, bookId, chapter) {
        document.getElementById(DIV_SCRIPTURES).innerHTML = chapterHTML;
        resetMapPins(extractGeoplaces());
        addNavButtons(bookId, chapter);
    }

    getScriptures =  function(bookId, chapter) {
        ajax(encodedScripturesURL(bookId, chapter), 
            function(chapterHTML) {
                getScripturesSuccess(chapterHTML, bookId, chapter);
            }, 
            getScripturesFailure, true);
    }
    
    navigateChapter = function(volumeId, bookId, chapter) {
        getScriptures(bookId, chapter)
        setCrumbs(volumeId, bookId, chapter);
        addNavButtons(bookId, chapter);
    }

    navigateBook = function(volumeId, bookId) {
        let book = books[bookId];
        if (book.numChapters === 0) {
            navigateChapter(volumeId, bookId, 0);
        } else {
            document.getElementById(DIV_SCRIPTURES).innerHTML = booksGrid(volumeId, book);
            setCrumbs(volumeId, bookId)
        }
    }

    navigateHome = function(volumeId) {
        document.getElementById(DIV_SCRIPTURES).innerHTML = volumesGridContent(volumeId)
        setCrumbs(volumeId)
    }

    volumesGridContent = function(volumeId) {
        let gridContent = "";
        //Show all the volumes
        volumes.forEach((volume) => {
            if ((volumeId === undefined) | (volumeId === volume.id)) {
            gridContent += `<div class="volume">${volumeTitle(volume)}</div>`;
            gridContent += booksGridContent(volume);
            }
        });
        return gridContent;
    };

    resetMap = function() {
        map["center"] = JERUSALEM
        map["zoom"] = 9
    }

    resetMapPins = function(geoplaces) {
        // Clear Stuff
        clearMapPins();
        // Load New Pins
        for (const key in geoplaces) {
            mapPins.push(addPin(geoplaces[key]))
        }
        if (mapPins.length > 0) {
            // Zoom and Center Display -> Assited by ChatGPT "How to recenter Google Maps around list of pins"
            var bounds = new google.maps.LatLngBounds();

            for (let i = 0; i < mapPins.length; ++i) {
                bounds.extend(mapPins[i].getPosition());
            }
            map.fitBounds(bounds);
            if (map["zoom"] > MAX_ZOOM) {
                map.setZoom(MAX_ZOOM)
            }
            
            
        }
    }

    setCrumbs = function(volumeId, bookId, chapterId) {
        let crumbsContent = `<li><a href="#">The Scriptures</a></li>`;
        if (volumeId !== undefined) {
            let volume = volumes.find(vol => vol.id === volumeId);
            crumbsContent += `<li><a href="#${volumeId}">${volume.fullName}</a></li>`;

            if (bookId !== undefined) {
                let book = volume.books.find(b => b.id === bookId);
                crumbsContent += `<li><a href="#${volumeId}:${bookId}">${book.fullName}</a></li>`;
                if (chapterId !== undefined && chapterId !== 0) {
                    crumbsContent += `<li><a href="#${volumeId}:${bookId}:${chapterId}">${chapterId}</a></li>`;
                }
            }
        }
        document.getElementById("crumb").innerHTML = `<ul><ul>${crumbsContent}</ul></ul>`;    
    }

    volumeTitle = function(volume) {
        let title = volume.fullName;
        return `<h5>${title}</h5>`
    }

// Public Methods
    init = function(readyListener) {
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

    onHashChanged = function(event) {
        let ids = [];

        if (location.hash !== "" && location.hash.length > 1) {
            ids = location.hash.slice(1).split(":");
        }

        if (ids.length <= 0) {
            navigateHome();
        } 
        else if (ids.length === 1) {
            const volumeId = Number(ids[0]);

            if (volumes.map((volume) => volume.id).includes(volumeId)) {
                navigateHome(volumeId);
            } else {
                navigateHome();
            }
        } else {
            const volumeId = Number(ids[0]);
            const bookId = Number(ids[1]);

            if (books[bookId] === undefined) {
                navigateHome();
            } else {
                if (ids.length === 2) {
                    navigateBook(volumeId, bookId);
                } else {
                    const chapter = Number(ids[2]);

                    if (bookChapterValid(bookId, chapter)) {
                        navigateChapter(volumeId, bookId, chapter);
                    } else {
                        navigateHome();
                    }
                }
            }
        }
    }

    showLocation = function(placename , latitude, longitude) {
        const geoplaces = {}
        const key = `${latitude} | ${longitude}`;
        const value = {
            placename: placename.replace(/'/g, ''),
            latitude: latitude,
            longitude: longitude
        }
        geoplaces[key] = value
        resetMapPins(geoplaces)
    }
    
//public API
    return{
        init,
        onHashChanged,
        showLocation
    };
}());


//console test
Scriptures.init(() => { console.log("initilized"); });