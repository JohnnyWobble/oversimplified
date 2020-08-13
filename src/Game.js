
import { INVALID_MOVE } from 'boardgame.io/core';
import { Delaunay } from "d3-delaunay";
import { polygon, union } from "@turf/turf"
import { noise } from '@chriscourses/perlin-noise'


export const TicTacToe = {
    setup: () => {
        var [width, height] = [1200, 800]
        var [mapTiles, neighborMap] = createGameBoard(1000, height, width)
        return { mapTiles, neighborMap: mapToObject(neighborMap), width, height }
    },

    moves: {
        moveTo: (G, ctx, fromId, toId, troops) => {

        },
        attackTile: (G, ctx, fromId, toId, troops) => {

        },
        build: (G, ctx, locationId, buildingType) => {

        },
        makeTroops: (G, ctx, location, building, troopType) => {

        }
    },

    turn: {
        moveLimit: 6
    },

    endIf: (G, ctx) => {
        return false
    },
};

class OnlyOneConnectingPointError extends Error {
    constructor(message) {
        super(message)
        this.name = "OnlyOneConnectingPointError"
    }
}
class IsEnclaveError extends Error { 
    constructor(message) {
        super(message)
        this.name = "IsEnclaveError"
    }
}
class AssertionError extends Error {
    constructor(message) {
        super(message)
        this.name = "AssertionError"
    }
 }

function mapToObject(map) {
    var keys = [...map.keys()]
    if (keys.length !== [...new Set(keys)].length) {
        throw new Error("Duplicate keys")
    }
    var obj = {}
    for (let key of keys) {
        obj["key" + key] = map.get(key)
    }
    return obj
}

function createGameBoard(numPoints, height, width) {
    var points = Array(numPoints)
        .fill(0)
        .map(() => [Math.floor(Math.random() * width), Math.floor(Math.random() * height)])
        .map(JSON.stringify)
        .reverse()
        .filter((e, i, a) => a.indexOf(e, i + 1) === -1)
        .reverse()
        .map(JSON.parse)

    var voronoi = Delaunay.from(points).voronoi([0, 0, width, height])

    var polygons = [...voronoi.cellPolygons()]
    var polygonsIndex = polygons.map((v, i) => i)
    var touching = []
    var mapTiles = []
    var neighborMap = new Map()

    while (polygonsIndex.length > 0) {
        if (polygonsIndex.length % 5 === 0) console.log(polygonsIndex.length)

        if (touching.length > 0) {
            var baseIndex = touching[Math.floor(Math.random() * touching.length)]
            polygonsIndex = polygonsIndex.filter((v) => v !== baseIndex)
        } else {
            var baseIndex = polygonsIndex.splice(Math.floor(Math.random() * polygonsIndex.length), 1)[0]
        }

        let polygonIndexes = [baseIndex]
        let basePolygon = polygons[baseIndex]
        let isLand = isLandPoint(points[baseIndex])
        let numPolys = Math.floor(Math.random() * (isLand ? 15 : 30)) + 8

        touching = [...voronoi.neighbors(baseIndex)].filter((value) => { return contains(polygonsIndex, value) })

        for (let nPoly = 0; nPoly < numPolys; nPoly++) {
            if (touching.length < 1) break

            let nextIndex = touching[0]
            if (touching.length > 1) {
                let nextPerimeter = getPerimeterFromPolys(basePolygon, polygons[nextIndex])
                for (let i = 1; i < Math.min(touching.length, isLand ? 3 : touching.length); i++) {
                    let tmpI = touching[i]
                    let tmpPerimeter = getPerimeterFromPolys(basePolygon, polygons[tmpI])

                    if (tmpPerimeter === Number.MAX_VALUE) {
                        touching.splice(tmpI, 1)
                        continue
                    } else if (tmpPerimeter < nextPerimeter) {
                        nextPerimeter = tmpPerimeter
                        nextIndex = tmpI
                    }
                }
            }

            touching = touching.filter((v) => v !== nextIndex)
            let nextPoly = polygons[nextIndex]

            if (isLand !== isLandPoint(points[nextIndex])) {
                nPoly--
                continue
            }

            try {
                basePolygon = combine(basePolygon, nextPoly)
                polygonIndexes.push(nextIndex)
            } catch (e) {
                if (e instanceof IsEnclaveError || e instanceof OnlyOneConnectingPointError) {
                    nPoly--
                    continue
                } else {
                    throw e
                }
            }
            polygonsIndex.splice(polygonsIndex.indexOf(nextIndex), 1)
            touching.push(...[...voronoi.neighbors(nextIndex)].filter((value) => { return contains(polygonsIndex, value) }))
        }

        mapTiles.push({
            polygon: basePolygon,
            points: polygonIndexes.map((v) => points[v]),
            cellsIndex: polygonIndexes,
            touchCellsIndex: [...new Set(polygonIndexes.map((v) => [...voronoi.neighbors(v)]).flat().filter((v) => !(polygonIndexes.includes(v))))],
            data:{ isOcean: !isLand, color:(!isLand ? "blue" : "green") },
            id: polygonsIndex.length})
    }
    var smallNeighborMap = new Map()
    for (var i = 0; i < mapTiles.length; i++) {
        for (let polyI of mapTiles[i].cellsIndex) {
            smallNeighborMap.set(polyI, i)
        }
    }

    for (i = 0; i < mapTiles.length; i++) {
        let touching = []
        for (let polyI of mapTiles[i].touchCellsIndex) {
            touching.push(smallNeighborMap.get(polyI))
        }
        neighborMap.set(i, touching)
    }

    var onePolyTilesIndexes = [...neighborMap.keys()].filter((v) => mapTiles[v].points.length === 1)
    var validOnePolyTiles = onePolyTilesIndexes.filter((v) => neighborMap.get(v).filter((v2) => mapTiles[v2].data.isOcean === mapTiles[v].data.isOcean).length > 0)
    var dontFit = []

    for (let polyI of validOnePolyTiles) {
        let validTouching = neighborMap.get(polyI).filter((v) => mapTiles[v].points.length !== 1).filter((v) => mapTiles[v].data.isOcean === mapTiles[polyI].data.isOcean)
        let perimeters = validTouching.map((v) => getPerimeterFromPolys(mapTiles[polyI].polygon, mapTiles[v].polygon))
        let perimeterDiffs = perimeters.map((v, i) => v - perimeter(mapTiles[validTouching[i]].polygon))
        let bestFitI = perimeterDiffs.indexOf(Math.min(...perimeterDiffs))

        if (perimeters[bestFitI] !== Number.MAX_VALUE) {
            let baseTile = mapTiles[validTouching[bestFitI]]
            let mergeTile = mapTiles[polyI]
            mapTiles[validTouching[bestFitI]] = {
                polygon: combine(baseTile.polygon, mergeTile.polygon),
                points: baseTile.points.concat(mergeTile.points),
                cellsIndex: baseTile.cellsIndex.concat(mergeTile.cellsIndex),
                touchCellsIndex: baseTile.touchCellsIndex.concat(mergeTile.touchCellsIndex),
                data: baseTile.data,
                id: baseTile.id
            }
        } else {
            dontFit.push(polyI)
        }
    }
    validOnePolyTiles = validOnePolyTiles.filter((v) => !dontFit.includes(v))
    validOnePolyTiles.sort((a, b) => b - a)

    for (let removeTile of validOnePolyTiles) {
        mapTiles.splice(removeTile, 1)
    }

    for (let removeTile of validOnePolyTiles) {
        let keys = [...neighborMap.keys()]
        keys.sort((a, b) => a - b)

        for (let key of keys) {
            if (key > removeTile) {
                neighborMap.set(key - 1, stepDown(neighborMap.get(key), removeTile))
                neighborMap.delete(key)

            } else if (key < removeTile) {
                neighborMap.set(key, stepDown(neighborMap.get(key), removeTile))
            }
        }
    }
    return [mapTiles, neighborMap]
}

function isLandPoint(point) {
    return noise(point[0] / 100, point[1] / 100, 0) > 0.5
}

function getPerimeterFromPolys(poly1, poly2) {
    assertNot(poly1, undefined); assertNot(poly2, undefined)
    try {
        return assertNot(perimeter(combine(poly1, poly2)), undefined)
    } catch (e) {
        if (e instanceof IsEnclaveError || e instanceof OnlyOneConnectingPointError) {
            return Number.MAX_VALUE
        } else {
            throw e
        }
    }
}

function assertNot(val1, val2) {
    if (JSON.stringify(val1) === JSON.stringify(val2)) {
        throw AssertionError(val1 + " == " + val2)
    } else {
        return val1
    }
}

function distance(xy1, xy2) {
    return Math.sqrt(Math.pow(xy1[0] - xy2[0], 2) + Math.pow(xy1[1] - xy2[1], 2))
}


function perimeter(poly) {
    var currentDistance = 0
    for (var i = 0; i < poly.length - 1; i++) {
        currentDistance += distance(poly[i], poly[i + 1])
    }
    return currentDistance
}

function combine(poly1, poly2) {
    if (poly1.slice().filter((v) => { return contains(poly2, v) }).length < 2) {
        throw new OnlyOneConnectingPointError()
    }
    try {
        var realPoly1 = polygon([poly1])
        var realPoly2 = polygon([poly2])
    } catch (e) {
        console.log(poly1, poly2)
        throw e
    }
    var uPoly = union(realPoly1, realPoly2)
    if (uPoly.geometry.coordinates.length > 1) {
        throw new IsEnclaveError()
    }
    return uPoly.geometry.coordinates[0]
}

function contains(arr, value) {
    try {
        for (var v of arr) {
            if (JSON.stringify(value) === JSON.stringify(v)) { return true }
        }
        return false
    } catch (e) {
        console.log(arr, value)
        throw e
    }
}

function stepDown(nums, stepAt) {
    return nums.filter((v) => v !== stepAt).map((v) => v > stepAt ? --v : v)
}