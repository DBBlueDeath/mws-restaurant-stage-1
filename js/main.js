let restaurants,
    neighborhoods,
    cuisines;
var map;
var markers = [];

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
    fetchNeighborhoods();
    fetchCuisines();
});

/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = () => {
    DBHelper.fetchNeighborhoods((error, neighborhoods) => {
        if (error) { // Got an error
            console.error(error);
        } else {
            self.neighborhoods = neighborhoods;
            fillNeighborhoodsHTML();
        }
    });
};

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
    const select = document.getElementById('neighborhoods-select');
    neighborhoods.forEach(neighborhood => {
        const option = document.createElement('option');
        option.innerHTML = neighborhood;
        option.value = neighborhood;
        select.append(option);
    })
    ;
};

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = () => {
    DBHelper.fetchCuisines((error, cuisines) => {
        if (error) { // Got an error!
            console.error(error);
        } else {
            self.cuisines = cuisines;
            fillCuisinesHTML();
        }
    })
    ;
};

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
    const select = document.getElementById('cuisines-select');

    cuisines.forEach(cuisine => {
        const option = document.createElement('option');
        option.innerHTML = cuisine;
        option.value = cuisine;
        select.append(option);
    })
    ;
};

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
    let loc = {
        lat: 40.722216,
        lng: -73.987501
    };
    self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: loc,
        scrollwheel: false
    });
    updateRestaurants();
};
window.onload = initMap;


updateFavoriteButton = () => {
    const button = document.getElementById('favorites-select');
    button.dataset.state = parseInt(button.dataset.state) == 1 ? 0 : 1;

    updateRestaurants();
};


function toggleFavorite() {
    const id = this.parentElement.dataset.id;
    const name = this.parentElement.getElementsByTagName('h2')[0].innerHTML;
    console.log(this, id);

    if (this.innerHTML == '♡ Unfavorite') {
        this.className = 'favorite';
        this.innerHTML = '♡ Favorite';
        this.setAttribute('aria-label', 'Mark restaurant ' + name + ' as favorite');
        DBHelper.updateFavorite(id, 0);
    } else {
        this.className = 'favorite active';
        this.innerHTML = '♡ Unfavorite';
        this.setAttribute('aria-label', 'Remove restaurant ' + name + ' from favorites');
        DBHelper.updateFavorite(id, 1);
    }
}


/**
 * Update page and map for current restaurants.
 */
updateRestaurants = () => {
    const nSelect = document.getElementById('neighborhoods-select');
    const cSelect = document.getElementById('cuisines-select');
    const fSelect = document.getElementById('favorites-select');

    const cIndex = cSelect.selectedIndex;
    const nIndex = nSelect.selectedIndex;

    const cuisine = cSelect[cIndex].value;
    const neighborhood = nSelect[nIndex].value;
    const favorite = fSelect.dataset.state;

    DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, favorite, (error, restaurants) => {
        if (error) { // Got an error!
            console.error(error);
        } else {
            resetRestaurants(restaurants);
            fillRestaurantsHTML();
        }
    })
};

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = (restaurants) => {
    // Remove all restaurants
    self.restaurants = [];
    const ul = document.getElementById('restaurants-list');
    ul.innerHTML = '';

    // Remove all map markers
    self.markers.forEach(m => m.setMap(null)
    )
    ;
    self.markers = [];
    self.restaurants = restaurants;
};

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
    const ul = document.getElementById('restaurants-list');
    restaurants.forEach(restaurant => {
        ul.append(createRestaurantHTML(restaurant));
    });
    addMarkersToMap();
};

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = (restaurant) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'listitem');
    li.dataset.id = restaurant.id;

    const picture = document.createElement('picture');
    const image = document.createElement('img');
    image.className = 'restaurant-img';
    image.sizes = '(max-width: 600px) 100vw, (max-width: 900px) 45vw, 40vw';
    image.src = DBHelper.imageUrlForRestaurant(restaurant);
    image.srcset = DBHelper.imageSRCSetForRestaurant(restaurant);
    image.alt = 'Picture of restaurant ' + restaurant.name;
    picture.append(image);
    li.append(picture);

    const name = document.createElement('h2');
    name.innerHTML = restaurant.name;
    name.tabIndex = 0;
    li.append(name);

    const neighborhood = document.createElement('p');
    neighborhood.innerHTML = restaurant.neighborhood;
    neighborhood.tabIndex = 0;
    neighborhood.setAttribute('aria-label', `Neighborhood: ${restaurant.neighborhood}`);
    li.append(neighborhood);

    const address = document.createElement('p');
    address.innerHTML = restaurant.address;
    address.tabIndex = 0;
    address.setAttribute('aria-label', `Address: ${restaurant.address}`);
    li.append(address);

    const more = document.createElement('a');
    more.innerHTML = 'View Details';
    more.href = DBHelper.urlForRestaurant(restaurant);
    more.setAttribute('aria-label', 'More about restaurant ' + restaurant.name);
    li.append(more);

    const favorite = document.createElement('a');
    if (parseInt(restaurant.is_favorite) == 1) {
        favorite.className = 'favorite active';
        favorite.innerHTML = '♡ Unfavorite';
        favorite.setAttribute('aria-label', 'Remove restaurant ' + restaurant.name + ' from favorites');
    } else {
        favorite.className = 'favorite';
        favorite.innerHTML = '♡ Favorite';
        favorite.setAttribute('aria-label', 'Mark restaurant ' + restaurant.name + ' as favorite');
    }
    favorite.onclick = toggleFavorite;
    li.append(favorite);

    return li;
};

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = (restaurants = self.restaurants) => {
    restaurants.forEach(restaurant => {
        // Add marker to the map
        const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
        google.maps.event.addListener(marker, 'click', () => {
            window.location.href = marker.url
        });
        self.markers.push(marker);
    });
};



if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(registration => {
            console.log('Service Worker Registered');
        });
        navigator.serviceWorker.ready.then(registration => {
            console.log('Service Worker Ready');
        }, err => {
            console.log('ServiceWorker reg failed, error: ', err);
        });
    });
}
