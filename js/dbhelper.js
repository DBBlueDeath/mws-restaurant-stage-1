/**
 * Common database helper functions.
 */
class DBHelper
{
    static getUrl() { return  '//localhost:1337/'; }
    static getFile() { return './data/restaurants.json'; }

    /**
     * Fetch all restaurants.
     */
    static fetchRestaurants(callback)
    {
        const db = new Dexie('MyDatabase');
        if (DBHelper.resolved == undefined) {
            DBHelper.resolved = 0;
        }
        DBHelper.db = db;

        // Declare tables, IDs and indexes
        db.version(1).stores({
            restaurants: '++id, name, neighborhood, cuisine_type'
        });

        // Fetch from IDB
        db.restaurants.toArray().then(function(restaurants) {
            console.log('IDB data ', restaurants);
            if (restaurants.length > 0) {

                callback(null, restaurants);
                DBHelper.resolved = 1;
            } else {
                console.log('IDB empty, fetch needed');
            }
        }).catch(function(error) {
            console.log('IDB get err', error);
        });

        // Fetch from remote (update IDB if remote is available)
        fetch(DBHelper.getUrl() + 'restaurants')
            .then(DBHelper.handleErrors)
            .then(function (response) {
                let a = response.json();
                console.log('DB Fetch1 response', a);
                return a;
            })
            .then(restaurants => DBHelper.storeInDB(restaurants))
            .then(restaurants => DBHelper.fetchReviews(restaurants)) // fetch reviews
            .then(restaurants => DBHelper.pushReviewsIfNeeded(restaurants)) // push offline data
            .then(function (restaurants) {
                if (!DBHelper.resolved) {
                    DBHelper.resolved = 1;

                    return callback(null, restaurants);
                } else {
                    console.log('DB Fetch render1 skip')
                }
            })
            .catch(function (error) {
                console.log('Error: remote request failed, getting data from local file', error);

                // only fetch the json file if IDB was not able to resolve the request and API is offline
                if (!DBHelper.resolved) {
                    fetch(DBHelper.getFile())
                        .then(DBHelper.handleErrors)
                        .then(function (response) {
                            let a = response.json();
                            console.log('DB Fetch2 response', a);
                            return a;
                        })
                        .then(function (restaurants) {
                            if (!DBHelper.resolved) {
                                DBHelper.storeInDB(restaurants.restaurants);
                                DBHelper.resolved = 1;
                                callback(null, restaurants);
                            } else {
                                console.log('DB Fetch2 render skip')
                            }
                        })
                        .catch(e => callback(e, null));
                }
            });
    }



    static fetchReviews(restaurants)
    {
        console.log('fetch reviews');

        return fetch(DBHelper.getUrl() + 'reviews')
            .then(DBHelper.handleErrors)
            .then(function (response) {
                let a = response.json();
                console.log('DB Fetch reviews response', a);

                return a;
            })
            .then(function (a) {
                let data = [];

                a.forEach(function(rev) {
                    if (!data[rev.restaurant_id]) {
                        data[rev.restaurant_id] = [];
                    }

                    data[rev.restaurant_id].push( {
                        "restaurant_id": parseInt(rev.restaurant_id),
                        "name": rev.name,
                        "rating": parseInt(rev.rating),
                        "comments": rev.comments,
                        "date": rev.date != undefined ? rev.date : rev.createdAt
                    });

                });

                data.forEach(function(r, k) {
                    //console.log(r, k);

                    DBHelper.db.restaurants.where('id').equals(k).modify(function (o) { o.reviews = r}).catch(e => console.log(e));
                    if (restaurants[k]) {
                        restaurants[k].reviews = r;
                    }
                });

                return restaurants;
            })
            .catch(function (error) {
                console.log('Error: remote request failed, getting data from local file', error);
                return restaurants;
            });
    }


    static handleErrors(response)
    {
        if (!response.ok) {
            throw Error(response.statusText);
        }

        return response;
    }

    static storeInDB(restaurants)
    {
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
    static fetchRestaurantById(id, callback)
    {
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


    static updateFavorite(id, fav)
    {
        // update local
        DBHelper.db.restaurants.where('id').equals(id).modify({'is_favorite': fav})
            .catch(e => console.log(e));

        // update remote
        fetch(DBHelper.getUrl() + 'restaurants/' + id + '/?is_favorite=' + fav, {method: 'PUT'})
            .catch(function (error) {
                console.log('Error: remote request failed', error);
            });

    }


    static addReview(event, form)
    {
        event.preventDefault();
        const id = form.id.value;

        let fail = false;
        let data = {
            "restaurant_id": parseInt(id),
            "name": form.name.value,
            "rating": parseInt(form.rating.value),
            "comments": form.review.value,
        };


        // update remote
        fetch(DBHelper.getUrl() + 'reviews/', {
            method: 'post',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
            .then(res => console.log('review  posted', res.json()))
            .catch(function (error) {
                fail = true;
                console.log('Error: remote request failed', error);
            })
            .then(function() {

            // update local
            data.flag = fail;

            DBHelper.db.restaurants.where('id').equals(id).modify(function (o) {o.reviews.push(data)}).catch(e => console.log(e));
        });
        //.then(window.location.reload());



        return false;
    }


    static pushReviewsIfNeeded(restaurants)
    {
        console.log('check for offline data');

        restaurants.forEach(function(r) {
            if (r.reviews != undefined) {
                r.reviews.forEach(function (e) {
                    if (e.flag) {
                        console.log('offline data found, submitting', e);
                        // update remote
                        fetch(DBHelper.getUrl() + 'reviews/', {
                            method: 'post',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(e)
                        })
                            .then(res => console.log('review  posted', res.json()))
                            .catch(function (error) {
                                console.log('Error: remote request failed', error);
                            });
                    }
                });
            }
        });

        // no update needed for the review because it will be pulled and overwritten from the remote anyway.
        return restaurants;
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
    static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, favorite, callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                let results = restaurants;
                if (favorite == '1') {
                    results = results.filter(r => r.is_favorite == 1);
                }
                if (cuisine != 'all') { // filter by cuisine
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
