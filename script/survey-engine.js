/**
 * OFFSZN Survey Engine
 * Handles logic for submitting surveys and allocating credit rewards.
 */

const SurveyEngine = {
    REWARD_AMOUNT: 60,

    /**
     * Submit a survey response and trigger reward
     * @param {string} surveyId - ID of the survey being answered
     * @param {Object} responses - Map of questionId -> answer
     */
    submitResponse: async function(surveyId, responses) {
        if (!window.supabaseClient) return { success: false, error: 'Supabase not initialized' };
        
        const userId = window.AuthUtils?.getUserId();
        if (!userId) return { success: false, error: 'User not authenticated' };

        try {
            // 1. Log the event
            if (window.Analytics) {
                window.Analytics.track('survey_submitted', { survey_id: surveyId }, 'conversion');
            }

            // 2. Save responses to public.survey_responses
            const { error: resError } = await window.supabaseClient
                .from('survey_responses')
                .insert([
                    {
                        user_id: userId,
                        survey_id: surveyId,
                        responses: responses
                    }
                ]);

            if (resError) throw resError;

            // 3. Increment reward_balance logic
            // First, get current balance
            const { data: user, error: userError } = await window.supabaseClient
                .from('users')
                .select('reward_balance')
                .eq('id', userId)
                .single();

            if (userError) throw userError;

            const newBalance = (user.reward_balance || 0) + this.REWARD_AMOUNT;

            // 4. Update the balance
            const { error: updateError } = await window.supabaseClient
                .from('users')
                .update({ reward_balance: newBalance })
                .eq('id', userId);

            if (updateError) throw updateError;

            return { success: true, reward: this.REWARD_AMOUNT };

        } catch (err) {
            console.error('❌ Survey Submission Failed:', err);
            return { success: false, error: err.message };
        }
    }
};

window.SurveyEngine = SurveyEngine;
