
import { supabase } from '../../database/connection.js';

export const getLeaderboard = async (req, res) => {
    try {
        // 1. Fetch Producers with Avatars (STRICT REQUIREMENT)
        // We only consider producers who have a custom avatar set.
        console.log("Fetching producers with avatars...");
        const { data: producers, error: userError } = await supabase
            .from('users')
            .select('id, nickname, avatar_url, banner_url, bio, is_verified, role, r2_version')
            .eq('is_producer', true)
            .not('avatar_url', 'is', null) // Must have avatar
            .neq('avatar_url', '')       // Must not be empty string
            .not('avatar_url', 'ilike', '%via.placeholder.com%') // No placeholders
            .not('avatar_url', 'ilike', '%dummyimage.com%')      // No placeholders
            .not('id', 'in', '("38c4925a-5a0b-4905-a1a3-8f7ecc939394","0382a813-85c7-46c3-8d2c-61a5692adffd","d8eafb25-0a6d-48fd-8a7f-3e79a328dfb8","4afe9d29-1b86-4af4-83fa-a78e87448555","ff68a2fd-49cb-41e6-b207-492ac683eea6")'); // Exclude test accounts and admins from leaderboard rank

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
        // NEW: Upload: 10 | Verified: 100 | Bio (Profile Complete): 50
        const scores = {};

        // Initialize Scores with State-Based Points
        producers.forEach(p => {
            let baseScore = 0;

            // Followers (10 pts)
            const fCount = followerCounts[p.id] || 0;
            baseScore += fCount * 10;

            // Verified Status (100 pts)
            if (p.is_verified) baseScore += 100;

            // Profile Completion (50 pts) - Bonus for Banner or Bio
            if (p.banner_url || (p.bio && p.bio.length > 5)) baseScore += 50;

            // --- SPECIAL EXCEPTIONS (Manual Boosts) ---
            // 1patboy_ (ID: ba3b36d9-945f-4d0e-9b86-984cf93b43e2) - Requested +1000 base points
            const isTarget = p.id === 'ba3b36d9-945f-4d0e-9b86-984cf93b43e2' ||
                (p.nickname && p.nickname.toLowerCase() === '1patboy_');
            if (isTarget) {
                baseScore += 1000;
            }

            scores[p.id] = baseScore;
        });

        // Add Product Stats & Upload Counts
        products?.forEach(prod => {
            if (scores[prod.producer_id] !== undefined) {
                const pScore =
                    (prod.views_count || 0) * 1 +
                    (prod.plays_count || 0) * 2 +
                    (prod.downloads_count || 0) * 20 +
                    (prod.sales_count || 0) * 50 +
                    10; // +10 points just for existing (Upload Reward)

                scores[prod.producer_id] += pScore;
            }
        });

        const productCounts = {};
        products?.forEach(prod => {
            productCounts[prod.producer_id] = (productCounts[prod.producer_id] || 0) + 1;
        });

        // 5. Sort and Format
        const leaderboard = producers.map(p => ({
            id: p.id,
            nickname: p.nickname,
            avatar_url: p.avatar_url,
            profile_cover: p.banner_url,
            role: p.role,
            is_verified: p.is_verified,
            r2_version: p.r2_version || 'v1',
            followers_count: followerCounts[p.id] || 0,
            products_count: productCounts[p.id] || 0,
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
