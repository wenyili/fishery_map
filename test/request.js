const axios = require('axios');

const testShips = async () => {
    try {
        const response = await axios.get('http://localhost:3000/ships', {
            params: {
                after: Date.now() - 1000 * 60 * 60 * 24,  // 24 hours ago
            },
        });
        console.log('Ships:', response.data);
    } catch (error) {
        console.error('Error:', error);
    }
};

const testShip = async (name) => {
    try {
        const response = await axios.get(`http://localhost:3000/ships/${name}`, {
            params: {
                after: Date.now() - 1000 * 60 * 60 * 24,  // 24 hours ago
            },
        });
        console.log('Ship:', response.data);
    } catch (error) {
        console.error('Error:', error);
    }
};

const testLatest = async () => {
    try {
        const response = await axios.get('http://localhost:3000/latest', {
            params: {
                after: Date.now() - 1000 * 60 * 60 * 24,  // 24 hours ago
            },
        });
        console.log('Latest:', response.data);
    } catch (error) {
        console.error('Error:', error);
    }
};

testShips();
testShip('MINJINYU05159');  // Replace 'shipname' with the name of a ship
testLatest();
