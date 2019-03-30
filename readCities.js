// http://download.geonames.org/export/dump/readme.txt

const fs = require('fs')

function *generateLinesFromFile(filePath) {
  const fileDescriptor = fs.openSync(filePath, 'r')
  let currentLine = Buffer.from([])
  let charsRead = 1

  while (charsRead != 0) {
    let nextChar = Buffer.alloc(1)
    charsRead = fs.readSync(fileDescriptor, nextChar, 0, 1)

    if('\n' === nextChar.toString('utf8')) {
      const line = currentLine.toString('utf8')
        .split('\r')
        .join('')
      currentLine = Buffer.from([])
      yield line
    } else {
      currentLine = Buffer.concat([currentLine, nextChar])
    }
  }

  fs.closeSync(fileDescriptor)
}

function reduceLinesFromFile(filePath, reducer, startingValue) {
  const lineGenerator = generateLinesFromFile(filePath)
  let end = false
  let aggregation = startingValue
  let index = 0

  while(!end) {
    const {value, done} = lineGenerator.next()
    if(!done) {
      aggregation = reducer(aggregation, value, index)
      index++
    } else {
      end = true
    }
  }

  return aggregation
}

function getDuplicateCities() {
  const citiesByName = reduceLinesFromFile('./cities500.txt', (acc, line, index) => {
    const [id, name] = line.split('\t')
    if(acc[name]) {
      acc[name].push(id)
    } else {
      acc[name] = [id]
    }
    return acc
  }, {})

  const duplicates = Object.entries(citiesByName)
    .filter(([name, ids]) => ids.length > 1)
    .reduce((acc, [name, ids]) => {
      acc[name] = ids
      return acc
    }, {})
  
  return duplicates
}

function saveDuplicateCities() {
  const duplicateIds = Object.entries(getDuplicateCities())
    .reduce((acc, [name, ids]) => {
      ids.forEach(id => {
        acc[id] = name
      })
      return acc
    }, {})
  
  const outputFile = fs.openSync('./duplicateCities.txt', 'w')

  reduceLinesFromFile('./cities500.txt', (acc, line) => {
    const [id] = line.split('\t')
    if(duplicateIds[id]) {
      fs.appendFileSync(outputFile, line + '\n')
    }
  })

  fs.closeSync(outputFile)
}

function convertDuplicatesToJson() {
  const duplicateCities = reduceLinesFromFile('./duplicateCities.txt', (acc, line) => {
    const [
      id,
      name,
      asciiName,
      altNames,
      lat,
      lng,
      featureClass,
      featureCode,
      countryCode,
      cc2,
      a1Code,
      a2Code,
      a3Code,
      a4Code,
      population,
      elevation,
      dem,
      timezone,
      modificationDate
    ] = line.split('\t')
    const obj = {
      id,
      name,
      pos: [
        lat,
        lng
      ],
      population
    }
    if(acc[name]) {
      acc[name].push(obj)
    } else {
      acc[name] = [obj]
    }
    return acc
  }, {})

  const fileData = `const cities = ${JSON.stringify(duplicateCities, null, 2)}`
  fs.writeFileSync('./cities.js', fileData)
}

function earthDistance(pos1, pos2) {
  const radius = 6371
  const latDiff = toRads(pos2[0] - pos1[0])
  const lngDiff = toRads(pos2[1] - pos1[1])

  const a = Math.sin(latDiff/2) * Math.sin(latDiff/2) + 
                Math.cos(toRads(pos1[0])) * Math.cos(toRads(pos2[0])) * 
                Math.sin(lngDiff/2) * Math.sin(lngDiff/2);  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = radius * c; 
  return distance;
}

function toRads(deg) {
  return deg * Math.PI / 180;
}

saveDuplicateCities()
convertDuplicatesToJson()