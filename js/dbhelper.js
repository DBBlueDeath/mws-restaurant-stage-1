/**
 * Common database helper functions.
 */
class DBHelper
{
    static getUrl() { return  'http://localhost:1337/restaurants'; }
    static getFile() { return './data/restaurants.json'; }

    /**
     * Fetch all restaurants.
     */
    static fetchRestaurants(callback) {
        const db = new Dexie('MyDatabase');
        DBHelper.resolved = 0;
        DBHelper.db = db;

        // Declare tables, IDs and indexes
        db.version(1).stores({
            restaurants: '++id, name, neighborhood, cuisine_type'
        });

        db.restaurants.toArray().then(function(restaurants) {
            console.log('IDB data ', restaurants);
            if (restaurants.length > 0) {
                DBHelper.resolved = 1;
                callback(null, restaurants);
            } else {
                console.log('IDB empty, fetch needed');
            }
        }).catch(function(error) {
            console.log('IDB get err', error);
        });

        fetch(DBHelper.getUrl())
            .then(DBHelper.handleErrors)
            .then(function (response) {
                let a = response.json();
                console.log('DB Fetch1 response', a);
                return a;
            })
            .then(restaurants => DBHelper.storeInDB(restaurants))
            .then(function (restaurants) {
                if (!DBHelper.resolved) {
                    DBHelper.resolved = 1;
                    callback(null, restaurants);
                } else {
                    console.log('DB Fetch render1 skip')
                }
            })
            .catch(function (error) {
                console.log('Error: remote request failed, getting data from local file', error);

                fetch(DBHelper.getFile())
                    .then(DBHelper.handleErrors)
                    .then(function (response) {
                        let a = response.json();
                        console.log('DB Fetch2 response', a);
                        return a;
                    })
                    .then(restaurants => DBHelper.storeInDB(restaurants.restaurants))
                    .then(function (restaurants) {
                        if (!DBHelper.resolved) {
                            DBHelper.resolved = 1;
                            callback(null, restaurants);
                        } else {
                            console.log('DB Fetch2 render skip')
                        }
                    })
                    .catch(e => callback(e, null));
            })
    }

    static handleErrors(response) {
        if (!response.ok) {
            throw Error(response.statusText);
        }

        return response;
    }

    static storeInDB(restaurants) {
        DBHelper.db.restaurants
            .where('id').above(0)
            .delete();

        DBHelper.db.restaurants.bulkAdd(restaurants);

        console.log('IDB update');

        return restaurants;
    }


    /**
     * Fetch a restaurant by its ID.
     */
    static fetchRestaurantById(id, callback) {
        // fetch all restaurants with proper error handling.
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                const restaurant = restaurants.find(r => r.id == id);
                if (restaurant) { // Got the restaurant
                    callback(null, restaurant);
                } else { // Restaurant does not exist in the database
                    callback('Restaurant does not exist', null);
                }
            }
        });
    }

    /**
     * Fetch restaurants by a cuisine type with proper error handling.
     */
    static fetchRestaurantByCuisine(cuisine, callback) {
        // Fetch all restaurants  with proper error handling
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Filter restaurants to have only given cuisine type
                const results = restaurants.filter(r => r.cuisine_type == cuisine);
                callback(null, results);
            }
        });
    }

    /**
     * Fetch restaurants by a neighborhood with proper error handling.
     */
    static fetchRestaurantByNeighborhood(neighborhood, callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Filter restaurants to have only given neighborhood
                const results = restaurants.filter(r => r.neighborhood == neighborhood);
                callback(null, results);
            }
        });
    }

    /**
     * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
     */
    static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                let results = restaurants;
                if (cuisine != 'all'
                ) { // filter by cuisine
                    results = results.filter(r => r.cuisine_type == cuisine);
                }
                if (neighborhood != 'all') { // filter by neighborhood
                    results = results.filter(r => r.neighborhood == neighborhood);
                }
                callback(null, results);
            }
        });
    }

    /**
     * Fetch all neighborhoods with proper error handling.
     */
    static fetchNeighborhoods(callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Get all neighborhoods from all restaurants
                const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
                // Remove duplicates from neighborhoods
                const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
                callback(null, uniqueNeighborhoods);
            }
        });
    }

    /**
     * Fetch all cuisines with proper error handling.
     */
    static fetchCuisines(callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Get all cuisines from all restaurants
                const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
                // Remove duplicates from cuisines
                const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
                callback(null, uniqueCuisines);
            }
        });
    }

    /**
     * Restaurant page URL.
     */
    static urlForRestaurant(restaurant) {
        return (`./restaurant.html?id=${restaurant.id}`);
    }

    /**
     * Restaurant image URL.
     */
    static imageUrlForRestaurant(restaurant) {
        return (`./img/${restaurant.photograph}.jpg`);
    }

    /**
     * Restaurant image SRCSet.
     */
    static imageSRCSetForRestaurant(restaurant) {
         return (`
         ./img/${restaurant.photograph}/${restaurant.photograph}_w_300.jpg 320w, 
         ./img/${restaurant.photograph}/${restaurant.photograph}_w_587.jpg 587w, 
         ./img/${restaurant.photograph}/${restaurant.photograph}_w_800.jpg 800w`);
    }

    /**
     * Map marker for a restaurant.
     */
    static mapMarkerForRestaurant(restaurant, map) {
        const marker = new google.maps.Marker({
                position: restaurant.latlng,
                title: restaurant.name,
                url: DBHelper.urlForRestaurant(restaurant),
                map: map,
                animation: google.maps.Animation.DROP
            }
        );
        return marker;
    }
}
