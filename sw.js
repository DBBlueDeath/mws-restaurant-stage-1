const version = '0.8.2';
let cn = 'mws-1-'  + version;
let fcn = 'f-mws-1-'  + version;

const urlsToCache = [
    './index.html',
    './restaurant.html',
    './css/styles.css',
    './css/normalize.css',
    './data/restaurants.json',
    './js/dbhelper.js',
    './js/main.js',
    './js/restaurant_info.js',
    './img/1.jpg',
    './img/2.jpg',
    './img/3.jpg',
    './img/4.jpg',
    './img/5.jpg',
    './img/6.jpg',
    './img/7.jpg',
    './img/8.jpg',
    './img/9.jpg',
    './img/10.jpg',
];



self.addEventListener('install', function (event) {
    console.log('Install ' + version);

    event.waitUntil(caches.open(cn).then(
        function (cache) {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('activate', event => {
    console.log('Activate ' + version);
    event.waitUntil(self.clients.claim());

    let cacheWhitelist = [cn];
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
                  return Promise.all(
                        cacheNames.map(function(cacheName) {
                              if (cacheWhitelist.indexOf(cacheName) === -1) {
                                    return caches.delete(cacheName);
                                  }
                            })
                      );
                })
    );
});



self.addEventListener('fetch', function (event) {
    console.log('Fetch: ', event.request.url);
    let requestUrl = new URL(event.request.url);

    if (requestUrl.origin === location.origin) {
// First look in network for the freshest resources

        let response = fetch(event.request).then(function (networkResponse) {
            let responseToStore = networkResponse.clone();

            caches.open(cn).then(function (cache) {
                cache.put(event.request, responseToStore);
            });

            return networkResponse;
        }).catch(function (error) {
// Network error, try to find resource in cache

            return caches.open(cn).then(function (cache) {
                return cache.match(event.request);
            });
        });

        event.respondWith(response);

        return;
    }


// Foreign requests, like google maps and analytics

    event.respondWith(
        caches.open(fcn).then(function (cache) {
            return cache.match(event.request).then(function (cachedResponse) {
                var newFetch = fetch(event.request).then(function (networkResponse) {
                    cache.put(event.request, networkResponse.clone());

                    return networkResponse;
                }).catch(function (error) {
                    return Response.error();
                });

                return cachedResponse || newFetch;
            })
        })
    );
});