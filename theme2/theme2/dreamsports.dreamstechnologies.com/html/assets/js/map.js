/*
Author       : Dreamguys
Template Name: DreamSports  - Bootstrap Template
Version      : 1.0
*/

google.maps.visualRefresh = true;
var slider, infowindow = null;
var bounds = new google.maps.LatLngBounds();
var map, current = 0;
var locations =[{
	"id":01,
	"doc_name":"Ruby Perrin",
	"speciality":"Personal blog",
	"address":"Florida, USA",
	"lat":53.470692,
	"lng":-2.220328,
	"icons":"default",
	"profile_link":"coach-detail.html",
	"total_review":"17",
	"image":'assets/img/profiles/avatar-01.jpg'
	}, {
		
	"id":02,
	"doc_name":"Fred Ortego",
	"speciality":"Personal blog",
	"address":"Newyork, USA",
	"lat":53.469189,
	"lng":-2.199262,
	"icons":"default",
	"profile_link":"coach-detail.html",
	"total_review":"35",
	"image":'assets/img/profiles/avatar-02.jpg'
	}, {
	"id":03,
	"doc_name":"Deborah Angel",
	"speciality":"Personal blog",
	"address":"Georgia, USA",
	"lat":53.468665,
	"lng":-2.189269,
	"icons":"default",
	"profile_link":"coach-detail.html",
	"total_review":"27",
	"image":'assets/img/profiles/avatar-03.jpg'
	}, {
	"id":04,
	"doc_name":"Sofia Brient",
	"speciality":"Personal blog",
	"address":"Louisiana, USA",
	"lat":53.463894,
	"lng":-2.177880,
	"icons":"default",
	"profile_link":"coach-detail.html",
	"total_review":"4",
	"image":'assets/img/profiles/avatar-04.jpg'
	}, {
	"id":05,
	"doc_name":"Marvin Campbell",
	"speciality":"Personal blog",
	"address":"Michigan, USA",
	"lat":53.466359,
	"lng":-2.213314,
	"icons":"default",
	"profile_link":"coach-detail.html",
	"total_review":"66",
	"image":'assets/img/profiles/avatar-05.jpg'
	}, {
	"id":06,
	"doc_name":" Katharine",
	"speciality":"Personal blog",
	"address":"Texas, USA",
	"lat":53.463906,
	"lng":-2.213271,
	"icons":"default",
	"profile_link":"coach-detail.html",
	"total_review":"52",
	"image":'assets/img/profiles/avatar-06.jpg'
	}, {
	"id":07,
	"doc_name":" Linda Tobin",
	"speciality":"Personal blog",
	"address":"Kansas, USA",
	"lat":53.461974,
	"lng":-2.210661,
	"icons":"default",
	"profile_link":"coach-detail.html",
	"total_review":"43",
	"image":'assets/img/profiles/avatar-07.jpg'
	}, {
	"id":08,
	"doc_name":" Paul Richard",
	"speciality":"Personal blog",
	"address":"California, USA",
	"lat":53.458785,
	"lng":-2.188532,
	"icons":"default",
	"profile_link":"coach-detail.html",
	"total_review":"49",
	"image":'assets/img/profiles/avatar-08.jpg'
	}, {
	"id":09,
	"doc_name":" John Gibbs",
	"speciality":"Personal blog",
	"address":"Oklahoma, USA",
	"lat":53.4558571,
	"lng":-2.1950372,
	"icons":"default",
	"profile_link":"coach-detail.html",
	"total_review":"112",
	"image":'assets/img/profiles/avatar-09.jpg'
	}, {
	"id":10,
	"doc_name":" Olga Barlow",
	"speciality":"Personal blog",
	"address":"Montana, USA",
	"lat":53.458850,
	"lng":-2.194549,
	"icons":"default",
	"profile_link":"coach-detail.html",
	"total_review":"65",
	"image":'assets/img/profiles/avatar-04.jpg'
	}, {
	"id":11,
	"doc_name":" Julia Washington",
	"speciality":"Personal blog",
	"address":"Oklahoma, USA",
	"lat":53.461733,
	"lng":-2.194502,
	"icons":"default",
	"profile_link":"coach-detail.html",
	"total_review":"5",
	"image":'assets/img/profiles/avatar-05.jpg'
	}, {
	"id":12,
	"doc_name":" Shaun Aponte",
	"speciality":"Personal blog",
	"address":"Indiana, USA",
	"lat":53.460548,
	"lng":-2.190956,
	"icons":"default",
	"profile_link":"coach-detail.html",
	"total_review":"5",
	"image":'assets/img/profiles/avatar-06.jpg'
	}
	];

var icons = {
  
};

function show() {
    infowindow.close();
  if (!map.slide) {
    return;
  }
    var next, marker;
    if (locations.length == 0 ) {
       return
     } else if (locations.length == 1 ) {
       next = 0;
     }
    if (locations.length >1) {
      do {
        next = Math.floor (Math.random()*locations.length);
      } while (next == current)
    }
    current = next;
    marker = locations[next];
    setInfo(marker);
    infowindow.open(map, marker);
}

function initialize() {
    var bounds = new google.maps.LatLngBounds();
    var mapOptions = {
        zoom: 14,
		center: new google.maps.LatLng(53.470692, -2.220328),
        scrollwheel: false,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
		
    };
  
     map = new google.maps.Map(document.getElementById('map'), mapOptions);
    map.slide = true;

    setMarkers(map, locations);
    infowindow = new google.maps.InfoWindow({
        content: "loading..."
    });
    google.maps.event.addListener(infowindow, 'closeclick',function(){
       infowindow.close();
    });
    slider = window.setTimeout(show, 3000);
}

function setInfo(marker) {
  var content = 
'<div class="profile-widget" style="width: 100%; display: inline-block;">'+
	'<div class="list-map-img">'+
		'<a href="' + marker.profile_link + '" tabindex="0" target="_blank">'+
			'<img class="img-fluid" alt="' + marker.doc_name + '" src="' + marker.image + '">'+
		'</a>'+
	'</div>'+
	'<div class="pro-content">'+
		'<h3 class="title">'+
			'<a href="' + marker.profile_link + '" tabindex="0">' + marker.doc_name + '</a>'+
			'<i class="fas fa-check-circle verified"></i>'+
		'</h3>'+
		'<ul class="available-info">'+
			'<li><i class="feather-map-pin"></i> ' + marker.address + ' </li>'+
		'</ul>'+
		'<div class="avalbity-review avalbity-review-list">'+
			'<ul>'+
				'<li>'+
					'<div class="avalibity-date">'+
						'<span><i class="feather-calendar"></i></span>'+
						'<div class="avalibity-datecontent">'+
							'<h6>Next Availabilty</h6>'+
							'<h5>24 May 2023</h5>'+
						'</div>'+
					'</div>'+
				'</li>'+
			'</ul>'+
		'</div>'+
	'</div>'+
'</div>';
  infowindow.setContent(content);
}

function setMarkers(map, markers) {
  for (var i = 0; i < markers.length; i++) {
    var item = markers[i];
    var latlng = new google.maps.LatLng(item.lat, item.lng);
    var marker = new google.maps.Marker({
        position: latlng,
        map: map,
        doc_name: item.doc_name,
        address: item.address,
        speciality: item.speciality,
        next_available: item.next_available,
        amount: item.amount,
        profile_link: item.profile_link,
        total_review: item.total_review,
        animation: google.maps.Animation.DROP,
        icon: icons[item.icons],
        image: item.image
        });
        bounds.extend(marker.position);
        markers[i] = marker;
        google.maps.event.addListener(marker, "click", function () {
            setInfo(this);
            infowindow.open(map, this);
            window.clearTimeout(slider);
        });
    }
    map.fitBounds(bounds);
  google.maps.event.addListener(map, 'zoom_changed', function() {
    if (map.zoom > 16) map.slide = false;
  });
}

google.maps.event.addDomListener(window, 'load', initialize);