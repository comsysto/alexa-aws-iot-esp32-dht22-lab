load('api_timer.js'); 
load('api_aws.js'); // aws support
load('api_dht.js'); // helper for the dht22 sensor

// create instance of DHT22 
let dht = DHT.create(32, DHT.DHT22);

// get a new value every 5 minutes
Timer.set(300000, true, function() {
    let currentTemp = dht.getTemp();
    let currentHumidity = dht.getHumidity();
    // update the device shadow with the latest values
    AWS.Shadow.update(0, {temp: currentTemp, humidity: currentHumidity});
}, null);