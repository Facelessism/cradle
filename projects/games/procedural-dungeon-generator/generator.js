/**
 * Dungeon Generator using Binary Space Partitioning (BSP)
 * Recursively divides the map into rooms and connects them with corridors.
 */

export class BSPNode {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.left = null;
        this.right = null;
        this.room = null; // {x, y, w, h}
    }
}

export class DungeonGenerator {
    constructor(width, height, minRoomSize, seed = null) {
        this.width = width;
        this.height = height;
        this.minRoomSize = minRoomSize;
        this.map = [];
        this.rooms = [];
        this.seed = seed || Math.floor(Math.random() * 100000);
        this.rng = this.createRNG(this.seed);
    }

    createRNG(seed) {
        // Simple Linear Congruential Generator for reproducible seeds
        let state = seed;
        return () => {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        };
    }

    generate() {
        this.initMap();
        const root = new BSPNode(0, 0, this.width, this.height);
        this.splitNode(root, 0);
        this.createRooms(root);
        this.createCorridors(root);
        this.placeStartEnd();
        return this.map;
    }

    initMap() {
        this.map = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(1); // 1 = Wall, 0 = Floor
            }
            this.map.push(row);
        }
    }

    splitNode(node, depth) {
        if (depth > 6) return; // Prevent infinite recursion

        const splitHorizontal = this.rng() > 0.5;

        if (node.width > this.minRoomSize * 2 && node.height > this.minRoomSize * 2) {
            // Can split either way, choose randomly
        } else if (node.width > this.minRoomSize * 2) {
            // Must split vertically
        } else if (node.height > this.minRoomSize * 2) {
            // Must split horizontally
        } else {
            return; // Cannot split further
        }

        const max_length = splitHorizontal ? node.height - this.minRoomSize : node.width - this.minRoomSize;
        if (max_length <= this.minRoomSize) return;

        const split = Math.floor(this.rng() * (max_length - this.minRoomSize)) + this.minRoomSize;

        if (splitHorizontal) {
            node.left = new BSPNode(node.x, node.y, node.width, split);
            node.right = new BSPNode(node.x, node.y + split, node.width, node.height - split);
        } else {
            node.left = new BSPNode(node.x, node.y, split, node.height);
            node.right = new BSPNode(node.x + split, node.y, node.width - split, node.height);
        }

        this.splitNode(node.left, depth + 1);
        this.splitNode(node.right, depth + 1);
    }

    createRooms(node) {
        if (!node.left && !node.right) {
            // Leaf node, create a room
            const roomW = Math.floor(this.rng() * (node.width - 2)) + 1;
            const roomH = Math.floor(this.rng() * (node.height - 2)) + 1;
            const roomX = node.x + Math.floor(this.rng() * (node.width - roomW));
            const roomY = node.y + Math.floor(this.rng() * (node.height - roomH));

            node.room = { x: roomX, y: roomY, w: roomW, h: roomH };
            this.rooms.push(node.room);
            this.carveRoom(node.room);
        } else {
            if (node.left) this.createRooms(node.left);
            if (node.right) this.createRooms(node.right);
        }
    }

    carveRoom(room) {
        for (let y = room.y; y < room.y + room.h; y++) {
            for (let x = room.x; x < room.x + room.w; x++) {
                if (y > 0 && y < this.height - 1 && x > 0 && x < this.width - 1) {
                    this.map[y][x] = 0;
                }
            }
        }
    }

    createCorridors(node) {
        if (!node.left || !node.right) return;

        this.createCorridors(node.left);
        this.createCorridors(node.right);

        const room1 = this.getRandomRoom(node.left);
        const room2 = this.getRandomRoom(node.right);

        if (room1 && room2) {
            this.connectRooms(room1, room2);
        }
    }

    getRandomRoom(node) {
        if (node.room) return node.room;
        const rooms = [];
        this.collectRooms(node, rooms);
        return rooms.length > 0 ? rooms[Math.floor(this.rng() * rooms.length)] : null;
    }

    collectRooms(node, rooms) {
        if (node.room) rooms.push(node.room);
        if (node.left) this.collectRooms(node.left, rooms);
        if (node.right) this.collectRooms(node.right, rooms);
    }

    connectRooms(room1, room2) {
        const x1 = Math.floor(room1.x + room1.w / 2);
        const y1 = Math.floor(room1.y + room1.h / 2);
        const x2 = Math.floor(room2.x + room2.w / 2);
        const y2 = Math.floor(room2.y + room2.h / 2);

        // L-shaped corridor
        if (this.rng() > 0.5) {
            this.carveHCorridor(x1, x2, y1);
            this.carveVCorridor(y1, y2, x2);
        } else {
            this.carveVCorridor(y1, y2, x1);
            this.carveHCorridor(x1, x2, y2);
        }
    }

    carveHCorridor(x1, x2, y) {
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            if (y > 0 && y < this.height - 1 && x > 0 && x < this.width - 1) {
                this.map[y][x] = 0;
            }
        }
    }

    carveVCorridor(y1, y2, x) {
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            if (y > 0 && y < this.height - 1 && x > 0 && x < this.width - 1) {
                this.map[y][x] = 0;
            }
        }
    }

    placeStartEnd() {
        if (this.rooms.length >= 2) {
            const startRoom = this.rooms[0];
            const endRoom = this.rooms[this.rooms.length - 1];

            this.map[Math.floor(startRoom.y + startRoom.h / 2)][Math.floor(startRoom.x + startRoom.w / 2)] = 2; // Start
            this.map[Math.floor(endRoom.y + endRoom.h / 2)][Math.floor(endRoom.x + endRoom.w / 2)] = 3; // End
        }
    }
}
