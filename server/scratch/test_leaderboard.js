import 'dotenv/config';
import { getLeaderboard } from '../src/infrastructure/http/controllers/LeaderboardController.js';

// Mock Express response object
const mockRes = {
    statusCode: 200,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(data) {
        console.log(`\nResponse Status: ${this.statusCode}`);
        console.log('Leaderboard calculated successfully! Top 5 results:');
        console.log(JSON.stringify(data.slice(0, 5), null, 2));
    }
};

const mockReq = {};

console.log('Testing getLeaderboard()...');
getLeaderboard(mockReq, mockRes).catch(err => {
    console.error('Test run failed:', err);
});
