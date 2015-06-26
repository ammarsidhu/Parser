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
    directionsService = new google.maps.DirectionsService();
    
    panorama = map.getStreetView();
    
    getdatafromjson();
    searchformissingcoords();
    
    
}

function getdatafromjson(){
    //get the data that was provided by the java program and geonames backround database.
    $.ajaxSetup( { "async": false } );
    $.getJSON('data1.json', function (data1) {
        allcitydata = data1;
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
                //updategeonamesarray();
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
    }
    else{
        if (allcitydata[i].geocode === false){ //could not find any geocode information for the location
            alert("no geocode for:" + allcitydata[i].city);
        }
        else{ // create a new marker for the city
            var position =  new google.maps.LatLng(allcitydata[i].latitude, allcitydata[i].longitude);   
            addMarker(allcitydata[i],position,i);
        }

    }
}
    convertToHtml(); //after all the markers have been made, create the text formatting and links for the text explorer
    createLines();
    
//    console.table(textToMarkersArray);
//    console.table(idNametoMarkerArray);
//    console.table(idNametoLineArray);
//    console.table(markertoAnchorID);
    console.log(allcitydata);
    console.log(Object.keys(allcitydata));
    //testID();
}
    

		
function addMarker(data, location, allcitydataindex){
    // this function is used to create new markers for a location or city.
    
    allcitydata[allcitydataindex].googlelocation = location; // add the google location object to allcitydata array
    allcitydata[allcitydataindex].linearrayindex = lineArrayIndex;
    //create the marker
    var marker = new google.maps.Marker({
        map: map, 
        position: location,
        title: data.city
    });	
    
    marker.setIcon('http://maps.google.com/mapfiles/marker.png');
//    var string = '<a href="#a' + textArray.length + '">' + data.text +  "</a>"; // set anchor tags around the sentence containing the location name so it can be linked
//                                                                                 to the text explorer
    
    //if the Sentence is contains multiple city locations, check it it is being used already
    var sentence = data.text;
    sentence = sentence.replace(data.city, "<b>" + data.city + "</b>");
    if (textArray.indexOf(data.text) > -1){// if the sentence has already been used, get html anchor id name
        var string = '<a href="#a' + textArray.indexOf(data.text) + '">' + sentence +  "</a>";
    }else {// create new anchor id
        var string = '<a href="#a' + textArray.length + '">' + sentence +  "</a>";
    }
    
    
    
    
    
    // create the infowindow when a marker is clicked containing the location name and text data
    marker.info = new google.maps.InfoWindow({
          content:  '<p><button id=b' + markerArray.length + ' onclick="deleteMarker(this.id)">Delete Marker</button></p>' + 
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
            

//            panorama.setPosition(location);
//            panorama.setVisible(true);
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
    
    allcitydata[allcitydataindex].markerArrayIndex = markerArray.length;

   
    var idindarray= [];
    var idindarray2 = [];
    var markerindarray = [];
    if (textArray.indexOf(data.text) > -1){
        idNametoMarkerArray["a" + textArray.indexOf(data.text) ].push(markerArray.length);
        idNametoLineArray["a" + textArray.indexOf(data.text) ].push(lineArrayIndex);
        markerindarray.push ("a" + textArray.indexOf(data.text));
        markertoAnchorID[markerArray.length] = markerindarray;
        allcitydata[allcitydataindex].anchorID = "a" + textArray.indexOf(data.text);
    }else{
        idindarray.push(markerArray.length);
        idindarray2.push(lineArrayIndex);
        idNametoMarkerArray["a" + (textArray.length) ] = idindarray;
        idNametoLineArray["a" + (textArray.length) ] = idindarray2;
        textArray.push(data.text);
        markerindarray.push ("a" + (textArray.length));
        allcitydata[allcitydataindex].anchorID = "a" + (textArray.length);
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
    allcitydata[allcitydataindex].linearrayindex = lineArrayIndex;
    if (textArray.indexOf(data.text) > -1){
        var string = '<a href="#a' + textArray.indexOf(data.text) + '">' + data.text +  "</a>";
    }else {
        var string = '<a href="#a' + textArray.length + '">' + data.text +  "</a>";
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
    var firstindex;
    for (var i in allcitydata){
        if(allcitydata[i].geocode){
            firstindex = i;
            break;
        }
    }
    
    var start = markerArray[firstindex].getPosition();
    var end;
    for (var i in allcitydata){
        if (allcitydata[i].geocode){
            end = allcitydata[i].googlelocation;
            addLine(start,end,i);
            start = end;
        }
    }
    showline();
}

function addLine (startPosition, endPosition, allcitydataindex){
    var pathLatLng = [];
    //need a beggining and end to line, if its the first location use it for both
    
    pathLatLng.push(startPosition);
    pathLatLng.push(endPosition);
    
    //choose the type of line or arrow
    var lineSymbol = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW
    };
    
    //choose some attributes for the line like colour and weight
    var pathline = new google.maps.Polyline({
        path: pathLatLng,
        geodesic: true, // change from curved lines to straight lines
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        icons: [{
            icon: lineSymbol,
            offset: '100%'
        }]
    });
    
    allcitydata[allcitydataindex].pathlineArrayIndex = pathlineArray.length;
    
    var test = google.maps.geometry.spherical.computeDistanceBetween (startPosition, endPosition)/1000;
    
    //console.log(test);
    
    pathlineArray.push(pathline);
}
		

function convertToHtml(){
    //function is used to create the highlighting and links in the text explorer
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
        
        
        var paragraphID;
        for (var i in textArray){
            var indexes = [];
            indexes = findAnchorallcitydataIndex("a" + i);
            paragraphID = document.getElementById("a" + i).parentElement.getAttribute('id');
            for(var j in indexes){
                allcitydata[indexes[j]].paragraphID = paragraphID;
                allcitydata[indexes[j]].paragraphIDNumber = paragraphID.slice(9);
            }
        }
       
        
        
    });
}

function findAnchorallcitydataIndex(anchorname){
    var indexes = [];
    for(var i in allcitydata){
           if(allcitydata[i].anchorID == anchorname){
               indexes.push(i);
           }
    }
    return indexes;
}

function testID(){
    for(var i in allcitydata){
        console.log(allcitydata[i].paragraphID);
        console.log(allcitydata[i].paragraphIDNumber);
        console.log(allcitydata[i].pathlineArrayIndex);
    }
}



function centerOnMarker(pass){
    //this function is used to centre the map on the related marker when a sentence is clicked in the text explorer
    
    p = pass.id;
    var idnum = p.slice(1); //get the id number "a12" -> "12"
    
    //close the rest of the infowindows
    for(i in markerArray){
        markerArray[i].info.close();
        markerArray[i].setIcon('http://maps.google.com/mapfiles/marker.png'); //set the old one to standard
    }
    
    var markerIndexes = textToMarkersArray[pass.innerHTML];
    for (var i in markerIndexes){
         markerArray[markerIndexes[i]].info.open(map, markerArray[markerIndexes[i]]); //open the relevant infowindow
         markerArray[markerIndexes[i]].setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png'); //set the current marker to green
    }
    //center the mao
    var LatLng  = markerArray[markerIndexes[0]].getPosition();
    map.setCenter(LatLng);
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
    var markerIndexes = idNametoMarkerArray[pass.id];
    var lineIndexes = idNametoLineArray[pass.id];
    if(markerIndexes == undefined){
        console.log("on undefined id:" + pass.id)
    }else{
        for (var i in markerIndexes){
            markerArray[markerIndexes[i]].setMap(map);
        }
        for (var i in lineIndexes){
            pathlineArray[lineIndexes[i]].setMap(map);
        }
        
    }
}



function setmarkerinvisible(pass){
    // set an individual marker to invisible, used for the scroll filter function
    var markerIndexes = idNametoMarkerArray[pass.id];
    var lineIndexes = idNametoLineArray[pass.id];
   if(markerIndexes == undefined){
        console.log("off undefined id:" + pass.id)
    }else{
        for (var i in markerIndexes){
            if(checkOtherAnchors(markerIndexes[i])){
                markerArray[markerIndexes[i]].setMap(null);
            }
        }
        for (var i in lineIndexes){
            pathlineArray[lineIndexes[i]].setMap(null);
        }
    }
}

function checkOtherAnchors(index){
    var anchorindexes = markertoAnchorID[index];
    var nootheranchors = true;
    for (var i in anchorindexes){
        if (isScrolledIntoView(document.getElementById(anchorindexes[i]))){
            nootheranchors = false;
        }
    }
    if (nootheranchors){
        return true;
    }
    else{
        return false;
    }
    
}

function isScrolledIntoView(elem) {
    // function to compute when a sentence is visible in the text explorer, used to filter the amount of lines and markers based on whats visible
    if ($(elem).length == 0) {
        return false;
    }
    var docViewTop = $('#inputtext').scrollTop();
    var docViewBottom = docViewTop + $('#inputtext').height();

    var elemTop = $(elem).offset().top;
    var elemBottom = elemTop + $(elem).height();
         
    return (docViewBottom >= elemTop && docViewTop <= elemBottom);
}

function deleteMarker(buttonID){
   
    var idnum = buttonID.slice(1);
    var city = markerArray[idnum].title;
    markerArray[idnum].setMap(null);
    var arrayindex = [];
    arrayindex = findCityIndexes(city);
    for(var i in arrayindex){
        allcitydata[arrayindex[i]].geocode = false;
    }
    //clearArray(pathlineArray);
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
        $('.jumpanchor').each(function () {
            if(scrollfilterflag == true){
                if(isScrolledIntoView(this)){
                    setmarkervisible(this);
                }
                else{
                    setmarkerinvisible(this);
                }
            }
        });
    })
    


});	


google.maps.event.addDomListener(window, 'load', initialise);

