/*global google */
/*global alert */
/*global window */
var map;
var geocoder;
var pathlineArray = [];
var markerArray = [];
var textArray = [];
var geonamesdatabasearray = [];
var nogeoarray = [];            //array to hold cities that couldn't be geolocated
var cityToMarkersArray = {};    //convert city name to marker array index
var textToMarkersArray = {};    //convert text name to marker array index
var idNametoMarkerArray = {};   //convert html anchor id to marker array index
var idNametoLineArray = {};     //convert anchor id to pathlineArray index
var markertoAnchorID = {};      //convert marker to anchor IDs
var lineArrayIndex = 0;
var allcitydata;                //hold json data
var lastposition;               //last position for lines
var subsetflag = false;         //flag for subset of lines
var clickindex=0;               //last icon clicked
var panorama;
var directionsService;
var scrollfilterflag = false;   //flag for handling text scroll filtering
var pressTimer;
var totaldistance = 0;
var rainbow = new Rainbow(); // used for the different colours of the lines.
var cityCounter = {}; //counts the number of times a city is referenced

function initialise() {
    
    //initialise map options
    var myLatlng = new google.maps.LatLng(43.650244, -79.390752); // Add the coordinates
    var mapOptions = {
        zoom: 4,
        minZoom: 3,
        maxZoom: 17,
        zoomControl: true,
        zoomControlOptions: {
            style: google.maps.ZoomControlStyle.DEFAULT // Change to SMALL to force just the + and - buttons.
        },
        center: myLatlng, // Centre the Map to coordinates
        mapTypeId: google.maps.MapTypeId.ROADMAP, // type of Map
        scrollwheel: true,
        panControl: false,
        mapTypeControl: false, // map or satellite view
        scaleControl: false, //hide scale
        streetViewControl: true, // hide street view
        overviewMapControl: false, // hide overview 
        rotateControl: false // disable rotate
    };
    
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    
    getdatafromjson();
    searchformissingcoords();
    
    
}

function getdatafromjson(){
    //get the data that was provided by the java program and geonames backround database.
    $.ajaxSetup( { "async": false } );
    $.getJSON('AllCityData.json', function (data1) {
        allcitydata = data1; //load the daata into the main backround array allcitydata
    });	
    $.ajaxSetup( { "async": true } );
    
}


function searchformissingcoords(){
    // search the data array to find locations that are missing coordinate data
    var deferstack = [];
    for (i= 0 ; i < allcitydata.length; i++ ) {
        if (allcitydata[i].geocode === false){ //if the coordinates are missing, use google geocode service to find them
                deferstack.push(geocode(i,allcitydata[i]));
        }  
    }
    
    //continue on with program only after all the outside http requests have finished
    // uses a stack as a counter, continue when stack is empty
    $.when.apply($, deferstack).done(function() {
                moreAddresses();
                //updategeonamesarray(); //decide if you want to update the geonames database
    });
}

function geocode(index, data1){
    // function is used to call the google geocode service and get coordinates for any locations that are missing that data
    geocoder = new google.maps.Geocoder();
    return $.Deferred(function(deferred) {  // use defers as a form of promise
        var url_addr = encodeURIComponent(data1.city); //need to transform string into url for php script
        $.getJSON('geocode.php?addr='+url_addr, function(reqdata) { // use outside php code to actually make the requests, takes some load off of the javascipt and 
            var results = reqdata.results;                          // transfers it to the backround server
            var status = reqdata.status;
            if (status == google.maps.GeocoderStatus.OK) {          // if the status is ok add data to the backround arrays
                var latitude = results[0].geometry.location.lat;
                var longitude = results[0].geometry.location.lng;
                var country;
                
                //This is used to get the country from the returned geocode request, and is used to update the backround geonames database with new locations
                for (var i=0; i<results[0].address_components.length; i++) {
                    for (var b=0;b<results[0].address_components[i].types.length;b++) {
                        if (results[0].address_components[i].types[b] == "country") {
                            
                            country = results[0].address_components[i].short_name;  
                            break;
                        }
                    }
                }
                
                //default value if no country found                
                if (typeof country == "undefined"){
                    country = "XX";
                }
                
                //create a location object and store it, use a negative elevation to easily find updates to the database that were made from this porgram
                var locationdata = {name: data1.city, latitude:latitude, longitude:longitude, country:country, elevation:-1000000};
                geonamesdatabasearray.push(locationdata);
                
                allcitydata[index].latitude = latitude;
                allcitydata[index].longitude = longitude;
                allcitydata[index].geocode = true;
                deferred.resolve(); //resolve the promise and remove it from the stack
            } else if (status === google.maps.GeocoderStatus.OVER_QUERY_LIMIT) { // if the query limit is reached (should be fixed now that the server makes the calls
                
                alert("Geocode failed: " + status);
                deferred.resolve();
            }else {
                nogeoarray.push(index);
                alert("Geocode failed: " + status);
                deferred.resolve();
            }
        })
    });
}


function updategeonamesarray(){
    // this is the function that sends data for the backround geonames database on the server to be updated with any info gained from google geocode service
    $.ajax({
        url: 'update_geonames_database.php',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(geonamesdatabasearray),
        dataType: 'json',
        success: function(msg) {
            //alert(msg);
        }
    })
}
	
function moreAddresses() {
// this function runs through the final data arrays and starts to create the markers.
for (var i in allcitydata) {
    if (allcitydata[i].city in cityToMarkersArray){ // if the city has already had a marker made, update it with the new information
        addExisting(allcitydata[i],i);
        cityCounter[allcitydata[i].city] = cityCounter[allcitydata[i].city] + 1; //keep a running total of how many times a city is referenced
    }
    else{
        if (allcitydata[i].geocode === false){ //could not find any geocode information for the location
            console.log("no geocode for:" + allcitydata[i].city);
        }
        else{ // create a new marker for the city
            var position =  new google.maps.LatLng(allcitydata[i].latitude, allcitydata[i].longitude);   
            addMarker(allcitydata[i],position,i);
            cityCounter[allcitydata[i].city] = 1; //add to running total of city name mentions
        }

    }
}
    convertToHtml(); //after all the markers have been made, create the text formatting and links for the text explorer
    createLines(); //create the lines connecting the places 
    

    console.table(cityCounter);
}
    

		
function addMarker(data, location, allcitydataindex){
    // this function is used to create new markers on the map for a location or city.
    
    allcitydata[allcitydataindex].googlelocation = location; // add the google location object to allcitydata array
    allcitydata[allcitydataindex].linearrayindex = lineArrayIndex; // add the line array index for this city in the allcitydata array
    //create the marker
    var marker = new google.maps.Marker({
        map: map, 
        position: location,
        title: data.city
    });	
    
    marker.setIcon('http://maps.google.com/mapfiles/marker.png');
//    var string = '<a href="#a' + textArray.length + '">' + data.text +  "</a>"; // set anchor tags around the sentence containing the location name so it can be linked
//                                                                                 to the text explorer
    
    //if the Sentence  contains multiple city locations, check it it is being used already
    //create the link to the text explorer in the marker infowindow
    var sentence = data.text;
    sentence = sentence.replace(data.city, "<b>" + data.city + "</b>");
    if (textArray.indexOf(data.text) > -1){// if the sentence has already been used, get html anchor id name that was assigned to it on its creation
        var string = '<a href="#a' + textArray.indexOf(data.text) + '">' + sentence +  "</a>";
    }else {// create new anchor id for unused text
        var string = '<a href="#a' + textArray.length + '">' + sentence +  "</a>";
    }
    
    
    
    
    
    // create the infowindow when a marker is clicked containing the location name and text data
    marker.info = new google.maps.InfoWindow({
          content:  '<p><button id=b' + markerArray.length + ' onclick="deleteMarker(this.id)">Delete Marker</button></p>' + // create the button to delete a city from vis
                    "<h3>"+ data.city + "</h3>" + string 
        });
    cityToMarkersArray[data.city] = markerArray.length; // map the city name to the marker array index 

    // listener for the marker click function
    google.maps.event.addListener(marker, 'click', function() {
            //set all the other markers to default icon
            for(i in markerArray){
                markerArray[i].setIcon('http://maps.google.com/mapfiles/marker.png');
            }
            marker.setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png'); //change the clicked marker to green
            clickindex = cityToMarkersArray[data.city]; //update click index to keep track of the last clicked marker
            //close all the other infowindows
            for(i in markerArray){
                markerArray[i].info.close();
            }
            marker.info.open(map, marker); // open this infowindow
            if (subsetflag == true) //send the location data to the subset function
            {
                showsubsetoflines(cityToMarkersArray[data.city]);
            }
            


        });
    
    //this is used to map the text to the marker array index (one sentence can contain multiple city locations)
    var indarray = [];
    if (data.text in textToMarkersArray){   //if the sentence contains more than one location and has already been used before
        textToMarkersArray[data.text].push(markerArray.length); //map the marker index to the text sentence, add it to the array
    }
    else{
        indarray.push(markerArray.length);
        textToMarkersArray[data.text] = indarray; //map the marker index to the text sentence
    }
    // add the marker array index to allcitydata
    allcitydata[allcitydataindex].markerArrayIndex = markerArray.length;

   
    
    var idindarray= [];
    var idindarray2 = [];
    var markerindarray = [];
    if (textArray.indexOf(data.text) > -1){ //check if the text has been assigned an anchor id, if it has use that one
        idNametoMarkerArray["a" + textArray.indexOf(data.text) ].push(markerArray.length); //map anchor id to the associated marker
        idNametoLineArray["a" + textArray.indexOf(data.text) ].push(lineArrayIndex); //map anchor id to the the associated line
        markerindarray.push ("a" + textArray.indexOf(data.text)); // add anchor id to temp array
        markertoAnchorID[markerArray.length] = markerindarray; //map marker index to anchor id (one marker can have many text values and anchors associated with it)
        allcitydata[allcitydataindex].anchorID = "a" + textArray.indexOf(data.text); // store the anchor id in the allcitydata backround array
    }else{ // else use the new id number
        idindarray.push(markerArray.length);
        idindarray2.push(lineArrayIndex);
        idNametoMarkerArray["a" + (textArray.length) ] = idindarray; //map new anchor id to the relevent marker
        idNametoLineArray["a" + (textArray.length) ] = idindarray2; //map new anchor id to the the associated line
        allcitydata[allcitydataindex].anchorID = "a" + (textArray.length); //store anchor id in allcitydata
        markerindarray.push ("a" + (textArray.length));
        textArray.push(data.text);        
        markertoAnchorID[markerArray.length] = markerindarray;
    }
    
   
   
    
    
    
    markerArray.push(marker); //add to markerArray array
    lineArrayIndex++;
}
		
function addExisting(data, allcitydataindex){
    var index = cityToMarkersArray[data.city]; //get marker array index for the city
    allcitydata[allcitydataindex].markerArrayIndex = index; //store marker index for this sentence
    var content = markerArray[index].info.getContent(this); //get existing content
    var location = markerArray[index].getPosition(); //get existing location
    allcitydata[allcitydataindex].googlelocation = location; //store the location data in allcitydata array
    allcitydata[allcitydataindex].linearrayindex = lineArrayIndex; //store the linearray index for this sentence in allcitydata
    
    var sentence = data.text;
    sentence = sentence.replace(data.city, "<b>" + data.city + "</b>");
    if (textArray.indexOf(data.text) > -1){ //check if the text has been assigned an anchor id, if it has use that one
        var string = '<a href="#a' + textArray.indexOf(data.text) + '">' + sentence +  "</a>";
    }else { // else use the new id number
        var string = '<a href="#a' + textArray.length + '">' + sentence +  "</a>";
    }
    
    
    
    content = content + "<p>" + string +  "</p>";
    
    markerArray[index].info.setContent(content);
    
    
    var indarray = [];
    if (data.text in textToMarkersArray){   //if the sentence contains more than one location
        textToMarkersArray[data.text].push(index); //map the marker index to the text sentence
    }
    else{
        indarray.push(index);
        textToMarkersArray[data.text] = indarray; //map the marker index to the text sentence
    }

    
     var idindarray= [];
    var idindarray2 = [];
    if (textArray.indexOf(data.text) > -1){
        idNametoMarkerArray["a" + textArray.indexOf(data.text) ].push(index);
        idNametoLineArray["a" + textArray.indexOf(data.text) ].push(lineArrayIndex);
        markertoAnchorID[index].push("a" + textArray.indexOf(data.text) );
        allcitydata[allcitydataindex].anchorID = "a" + textArray.indexOf(data.text);
    }else{
        idindarray.push(index);
        idindarray2.push(lineArrayIndex);
        idNametoMarkerArray["a" + (textArray.length) ] = idindarray;
        idNametoLineArray["a" + (textArray.length) ] = idindarray2;
        allcitydata[allcitydataindex].anchorID = "a" + (textArray.length);
        markertoAnchorID[index].push("a" + (textArray.length));
        textArray.push(data.text);
    }
    
    
    
    lineArrayIndex++;
}

function createLines(){
    pathlineArray.length = 0; // clear the array if this function is run to update the line
    totaldistance = 0;
    var firstindex;
    
    for (var i in allcitydata){ // find first valid city, use it as start
        if(allcitydata[i].geocode){
            firstindex = i;
            break;
        }
    }
    
    var start = markerArray[firstindex].getPosition(); //get the position of the starting marker
    var end;
    
    var numOfLines = 0;
    numOfLines = countValidPlaces();
    rainbow.setNumberRange(1, numOfLines); //set number of steps in the gradient for the colour of the lines
    rainbow.setSpectrum('red', 'blue'); // set the different colours of the gradient, default is a rainbow.
    
    var linecount = 1; // usedd for the step in the gradient
    
    for (var i in allcitydata){
        if (allcitydata[i].geocode){ //if it is a valid place name
            end = allcitydata[i].googlelocation;
            addLine(start,end,i, linecount); //create the line
            start = end; //iterate to next location
            linecount++;
        }
    }
    showline();
}

function addLine (startPosition, endPosition, allcitydataindex, rainbowNumber){
    var pathLatLng = [];
    
    pathLatLng.push(startPosition);
    pathLatLng.push(endPosition);
    
    //choose the type of line or arrow
    var lineSymbol = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW
    };
    
    //choose some attributes for the line like colour and weight
    var pathline = new google.maps.Polyline({
        path: pathLatLng,
        geodesic: true, // this is for curved lines, set to false for straight point to point lines between markers
        strokeColor: "#" + rainbow.colourAt(rainbowNumber),
        strokeOpacity: 1.0,
        strokeWeight: 2,
        icons: [{
            icon: lineSymbol,
            offset: '100%'
        }]
    });
    
    allcitydata[allcitydataindex].pathlineArrayIndex = pathlineArray.length; //store the pathline array index in allcitydtaa
    
    var distance = google.maps.geometry.spherical.computeDistanceBetween (startPosition, endPosition)/1000; // the distance between the start point and end point in km
    totaldistance = totaldistance + distance;
   
    
    pathlineArray.push(pathline);
}
		

function convertToHtml(){
    //function is used to create the highlighting and links in the text explorer, converting plain text to html anchor links
    jQuery.get('HTMLparagraph.txt', function(noveltext) { // load the data
        var string = noveltext;
        for (var i in textArray){
                //create the html tag with the anchor id and the onclick function
                var stringreplace = '<a id="a' + i + '"  class="jumpanchor" style="background-color:yellow" href="#" onclick="centerOnMarker(this);">' + textArray[i] + "</a>";

                // ignore any whitespace formatting when searching for the sentence
                var num = textArray[i].split(' ');
                var t = num[0];
                for(i = 1; i < num.length; i++){
                    t += "([\\s]*)" + num[i];
                }
                var regex = new RegExp(t);
            
            
                noveltext = noveltext.replace(regex, stringreplace); //replace the old text with the new one with html tags

        }
        document.getElementById("inputtext").innerHTML = noveltext; //update the html dom element with the new formatted text
        
        // this is used to find the id of the dom element (paragraph) that contains a piece of highlighted text, used to compute length of the novel (in paragraphs) between loactions
        var paragraphID;
        for (var i in textArray){
            var indexes = [];
            indexes = findAnchorallcitydataIndex("a" + i); //look for the allcitydata indexes that correspond to the associated text sentence
            paragraphID = document.getElementById("a" + i).parentElement.getAttribute('id'); //get the paragraph that contains the text sentence anchor
            for(var j in indexes){
                allcitydata[indexes[j]].paragraphID = paragraphID; //save the paragraph id in allcitydata
                allcitydata[indexes[j]].paragraphIDNumber = paragraphID.slice(9); //save the paragraph id number for any calcultions (paragraph12 -> 12)
            }
        }
       
        
        
    });
}

function findAnchorallcitydataIndex(anchorname){
    // one anchor or sentence can contain many city names, this is used to find the index numbers in allcitydata that is associated with one anchor
    var indexes = [];
    for(var i in allcitydata){
           if(allcitydata[i].anchorID == anchorname){
               indexes.push(i);
           }
    }
    return indexes;
}




function centerOnMarker(pass){
    //this function is used to centre the map on the related marker when a sentence is clicked in the text explorer
    
    anchorid = pass.id;
    var idnum = anchorid.slice(1); //get the id number "a12" -> "12"
    
    //close the rest of the infowindows
    for(i in markerArray){
        markerArray[i].info.close();
        markerArray[i].setIcon('http://maps.google.com/mapfiles/marker.png'); //set the markers to the standard red one
    }
    
    //var markerIndexes = textToMarkersArray[pass.innerHTML];
    var markerIndexes = idNametoMarkerArray[anchorid]; //get the marker indexes that correspond to an anchor id name
    
    for (var i in markerIndexes){
         markerArray[markerIndexes[i]].info.open(map, markerArray[markerIndexes[i]]); //open the relevant infowindow
         markerArray[markerIndexes[i]].setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png'); //set the current marker to green
    }
    //center the map
    var LatLng  = markerArray[markerIndexes[0]].getPosition(); //choose one of the markers to centre on (one sentence can reference many places)
    map.panTo(LatLng); // pan to the location
    map.setZoom(6);
    clickindex = markerIndexes[0];
    if (subsetflag == true)
    {
        showsubsetoflines(parseInt(idnum));
    }
    
}

function removeline(){
    //loop through and set the lines to invisible
    for(i in pathlineArray){
        pathlineArray[i].setMap(null);
    }
}

function showline(){
    // loop through and set the lines to visible
    subsetflag = false;
    for(i in pathlineArray){
        pathlineArray[i].setMap(map);
    }
}


function showsubsetoflines(index){
    // show a subset of the lines, two ahead and two behind the current marker
    subsetflag = true;
    removeline();
    
    for(i = index - 1; (i < index + 3) && (i < pathlineArray.length - 1); i++){
        if(i<0){
            i=0;
        }
            
        pathlineArray[i].setMap(map);     
    }
    
    
}

function removemarkers(){
    // loop through and set  all the markers to invisible
    for(i in markerArray){
        markerArray[i].setMap(null);
    }
}

function restoremarkers(){
    // loop through and set the markers to visible
     for(i in markerArray){
        markerArray[i].setMap(map);
    }
}


function setmarkervisible(pass){
    // set an individual marker to visible, used for the scroll filter function
    var markerIndexes = idNametoMarkerArray[pass.id]; // one sentence can contain many city names, use the data map of id names to marker array indexs
    var lineIndexes = idNametoLineArray[pass.id]; // one sentence can contain many lines between cities ,use the data map of id names to line array indexs
    if(markerIndexes == undefined){ 
        console.log("set marker visible error undefined id:" + pass.id)
    }else{
        for (var i in markerIndexes){ //for all the markers associated with a single line of text, set to visiblie
            markerArray[markerIndexes[i]].setMap(map);
        }
        for (var i in lineIndexes){ // do the same with the lines
            pathlineArray[lineIndexes[i]].setMap(map);
        }
        
    }
}



function setmarkerinvisible(pass){
    // set an individual marker to invisible, used for the scroll filter function
    var markerIndexes = idNametoMarkerArray[pass.id]; // one sentence can contain many city names, use the data map of id names to marker array indexs to find these markers
    var lineIndexes = idNametoLineArray[pass.id]; //same for lines
   if(markerIndexes == undefined){
        console.log("off undefined id:" + pass.id)
    }else{
        for (var i in markerIndexes){
            if(checkOtherAnchors(markerIndexes[i])){ // check for race condition, one city can have text that is both visible and invisible in the text explorer
                markerArray[markerIndexes[i]].setMap(null);
            }
        }
        for (var i in lineIndexes){
            pathlineArray[lineIndexes[i]].setMap(null);
        }
    }
}

function checkOtherAnchors(index){
    // this is used to check if a marker has mutliple anchors associated with it. It prevents a race condition when a city is both not visible in one anchor and visible 
    // in another. 
    var anchorindexes = markertoAnchorID[index]; // get all the anchors that are associated with one city
    var noOtherAnchors = true;
    for (var i in anchorindexes){
        if (isScrolledIntoView(document.getElementById(anchorindexes[i]))){ // if any of the anchors are associated with a place are visible, keep it visible
            noOtherAnchors = false;
        }
    }
    return noOtherAnchors;
    
}

function isScrolledIntoView(elem) {
    // function to compute when a sentence is visible in the text explorer, used to filter the amount of lines and markers based on whats visible
    if ($(elem).length == 0) {
        return false;
    }
    var docViewTop = $('#inputtext').scrollTop(); //get top of scroll dom element
    var docViewBottom = docViewTop + $('#inputtext').height(); //get bottom of scroll dom element

    var elemTop = $(elem).offset().top; //get the  height of the anchor in the scroll element
    var elemBottom = elemTop + $(elem).height();
         
    return (docViewBottom >= elemTop && docViewTop <= elemBottom); //if the anchor is visible return true
}

function deleteMarker(buttonID){
   
    var idnum = buttonID.slice(1); // get marker index from button ("b12" -> 12)
    var city = markerArray[idnum].title; // get the city name of the marker
    markerArray[idnum].setVisible(false);
    markerArray[idnum].info.close();
    markerArray[idnum].setMap(null); //remove the marker
    
    var arrayindex = [];
    arrayindex = findCityIndexes(city); // find the indexes in allcitydata that correspond to the city name
    for(var i in arrayindex){
        allcitydata[arrayindex[i]].geocode = false;
        var anchorid = allcitydata[arrayindex[i]].anchorID; // find the anchor id for this sentence
        if (idNametoMarkerArray[anchorid].length < 2){ // if there is only one city associated with the anchor to be deleted
            idNametoMarkerArray[anchorid].pop(); // clear it from the id to marker array data map
            var div = document.getElementById(anchorid); // get the dom element associated with the anchor
            div.style.backgroundColor = 'white';
            div.removeAttribute("href"); //remove the link in the text explorer
        }else{ //if the anchor is associeated with more than one city, remove any references to the deleted city only
            var array = idNametoMarkerArray[anchorid]; // get the list of markers associeated with anchor
            var index = array.indexOf(allcitydata[arrayindex[i]].markerArrayIndex); // find the index of the deleted city
            //var index =  $.inArray(allcitydata[arrayindex[i]].markerArrayIndex, array); // find the index of the deleted city
            if (index >= 0) {
              array.splice( index, 1 ); // remove it from the data map
            }
            idNametoMarkerArray[anchorid] = array; // set the data map to the new array thats had the city deleted from it.
            
        }
            
    }
    
    
    removeline();
    createLines();
}

function findCityIndexes(cityname){
    var cityindexarray = [];
    for(var i in allcitydata){
        if (allcitydata[i].city == cityname){
            cityindexarray.push(i);
        }
    }
    return cityindexarray;
}

function countValidPlaces(){
    var count = 0;
    for (var i in allcitydata){
        if(allcitydata[i].geocode){
            count++;
        }
    }
    return count;
}



jQuery(function($) {
    
    // thes functions control the checkboxes function at the top of the visualisation
    $('#scrollfiltercheckbox').click(function () {
        if ($('#scrollfiltercheckbox').prop('checked')) {
            scrollfilterflag = true;
        } else {
            scrollfilterflag = false;
            showline();
            restoremarkers();
        }
    });
    
    
    $('#showsubsetcheckbox').click(function () {
        if ($('#showsubsetcheckbox').prop('checked')) {
            showsubsetoflines(clickindex);
        } else {
            showline();
        }
    });
    
    $('#showmarkerscheckbox').click(function () {
        if ($('#showmarkerscheckbox').prop('checked')) {
            restoremarkers();
        } else {
            removemarkers();
        }
    });
    
    $('#showlinescheckbox').click(function () {
        if ($('#showlinescheckbox').prop('checked')) {
            showline();
        } else {
            removeline();
        }
    });
    
    // scroll view function
    $('#content').bind('scroll', function() {
        var scrollindexes = [];
        $('.jumpanchor').each(function () {
            if(scrollfilterflag == true){
                if(isScrolledIntoView(this)){
                    setmarkervisible(this);
                    scrollindexes.push(this.id);
                }
                else{
                    setmarkerinvisible(this);
                }
            }
        });
        var anchorid = scrollindexes[scrollindexes.length-1];
        centerOnMarker(document.getElementById(anchorid));
        scrollindexes.length = 0;
    })
    


});	


google.maps.event.addDomListener(window, 'load', initialise);

