const fs = require('fs');
fs.readFile('data/ships.json', 'utf8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    const ships = JSON.parse(data)
    console.log(ships.length);

    const set = new Set()
    ships.forEach(element => {
        // console.log(element.name_en)
        if (set.has(element.name_en)) {
            console.log(element.name_en)
        }
        set.add(element.name_en)
    });
    console.log(set.size)
});