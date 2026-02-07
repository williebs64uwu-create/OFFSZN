
import { supabase } from '../../database/connection.js';

export const getLeaderboard = async (req, res) => {
    try {
        // 1. Fetch Producers with Avatars (STRICT REQUIREMENT)
        // We only consider producers who have a custom avatar set.
        console.log("Fetching producers with avatars...");
        const { data: producers, error: userError } = await supabase
            .from('users')
            .select('id, nickname, avatar_url, is_verified') // Removed non-existent followers_count
            .eq('is_producer', true)
            .not('avatar_url', 'is', null) // Must have avatar
            .neq('avatar_url', '')       // Must not be empty string
            .neq('nickname', 'willieinspired'); // Exclude Admin/Test Account as requested

        if (userError) {
            console.error("User Fetch Error:", userError);
            throw userError;
        }
        console.log(`Found ${producers?.length} producers with avatars.`);

        if (!producers || producers.length === 0) {
            return res.status(200).json([]);
        }

        const producerIds = producers.map(p => p.id);

        // 2. Fetch Product Stats
        // We use the "Real Data" columns as requested: views_count, plays_count, downloads_count, sales_count
        const { data: products, error: prodError } = await supabase
            .from('products')
            .select('producer_id, views_count, plays_count, downloads_count, sales_count')
            .in('producer_id', producerIds)
            .eq('status', 'approved'); // Only active products count

        if (prodError) throw prodError;

        // 3. Followers Count (Real Data)
        // We select user_id (the producer being followed)
        const { data: followersData, error: followersError } = await supabase
            .from('followers')
            .select('user_id')
            .in('user_id', producerIds);

        const followerCounts = {};
        if (followersData) {
            followersData.forEach(f => {
                followerCounts[f.user_id] = (followerCounts[f.user_id] || 0) + 1;
            });
        }

        // 4. Calculate Scores (Aggregating Stats)
        // Formula aligned with Trending:
        // Views: 1 | Plays: 2 | Downloads: 20 | Sales: 50 | Follower: 10
        const scores = {};

        // Initialize Scores with Follower Points (10 pts per follower)
        producers.forEach(p => {
            const fCount = followerCounts[p.id] || 0;
            scores[p.id] = fCount * 10;
        });

        // Add Product Stats
        products?.forEach(prod => {
            if (scores[prod.producer_id] !== undefined) {
                const pScore =
                    (prod.views_count || 0) * 1 +
                    (prod.plays_count || 0) * 2 +
                    (prod.downloads_count || 0) * 20 +
                    (prod.sales_count || 0) * 50;

                scores[prod.producer_id] += pScore;
            }
        });

        // 5. Sort and Format
        const leaderboard = producers.map(p => ({
            id: p.id,
            nickname: p.nickname,
            avatar_url: p.avatar_url,
            is_verified: p.is_verified,
            score: scores[p.id] || 0,
            trend: 'neutral'
        }))
            .sort((a, b) => b.score - a.score) // Descending
            .slice(0, 10) // Top 10
            .map((p, i) => ({ ...p, rank: i + 1 })); // Assign Rank

        res.status(200).json(leaderboard);

    } catch (err) {
        console.error("Error calculating leaderboard:", err);
        res.status(500).json({ error: 'Error generating leaderboard', details: err.message, h: err.hint });
    }
};
