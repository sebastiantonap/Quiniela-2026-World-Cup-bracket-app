-- ============================================================
-- 012: Correct knockout placeholders to the official FIFA 2026 bracket.
-- The original seed used a generic/sequential mapping that produced the
-- wrong matchups (group pairings in R32, and which winners meet in R16/QF).
-- SF / 3rd place / Final were already correct and are left untouched.
-- Best-3rd slots now carry their allowed source groups; the exact team is
-- assigned by the admin per FIFA's qualifying-combination table.
-- ============================================================

-- ROUND OF 32 (73–88)
UPDATE matches SET placeholder_home = '2nd Group A', placeholder_away = '2nd Group B'            WHERE match_number = 73;
UPDATE matches SET placeholder_home = '1st Group E', placeholder_away = 'Best 3rd (A/B/C/D/F)'   WHERE match_number = 74;
UPDATE matches SET placeholder_home = '1st Group F', placeholder_away = '2nd Group C'            WHERE match_number = 75;
UPDATE matches SET placeholder_home = '1st Group C', placeholder_away = '2nd Group F'            WHERE match_number = 76;
UPDATE matches SET placeholder_home = '1st Group I', placeholder_away = 'Best 3rd (C/D/F/G/H)'   WHERE match_number = 77;
UPDATE matches SET placeholder_home = '2nd Group E', placeholder_away = '2nd Group I'            WHERE match_number = 78;
UPDATE matches SET placeholder_home = '1st Group A', placeholder_away = 'Best 3rd (C/E/F/H/I)'   WHERE match_number = 79;
UPDATE matches SET placeholder_home = '1st Group L', placeholder_away = 'Best 3rd (E/H/I/J/K)'   WHERE match_number = 80;
UPDATE matches SET placeholder_home = '1st Group D', placeholder_away = 'Best 3rd (B/E/F/I/J)'   WHERE match_number = 81;
UPDATE matches SET placeholder_home = '1st Group G', placeholder_away = 'Best 3rd (A/E/H/I/J)'   WHERE match_number = 82;
UPDATE matches SET placeholder_home = '2nd Group K', placeholder_away = '2nd Group L'            WHERE match_number = 83;
UPDATE matches SET placeholder_home = '1st Group H', placeholder_away = '2nd Group J'            WHERE match_number = 84;
UPDATE matches SET placeholder_home = '1st Group B', placeholder_away = 'Best 3rd (E/F/G/I/J)'   WHERE match_number = 85;
UPDATE matches SET placeholder_home = '1st Group J', placeholder_away = '2nd Group H'            WHERE match_number = 86;
UPDATE matches SET placeholder_home = '1st Group K', placeholder_away = 'Best 3rd (D/E/I/J/L)'   WHERE match_number = 87;
UPDATE matches SET placeholder_home = '2nd Group D', placeholder_away = '2nd Group G'            WHERE match_number = 88;

-- ROUND OF 16 (89–96)
UPDATE matches SET placeholder_home = 'Winner M73', placeholder_away = 'Winner M75' WHERE match_number = 89;
UPDATE matches SET placeholder_home = 'Winner M74', placeholder_away = 'Winner M77' WHERE match_number = 90;
UPDATE matches SET placeholder_home = 'Winner M76', placeholder_away = 'Winner M78' WHERE match_number = 91;
UPDATE matches SET placeholder_home = 'Winner M79', placeholder_away = 'Winner M80' WHERE match_number = 92;
UPDATE matches SET placeholder_home = 'Winner M83', placeholder_away = 'Winner M84' WHERE match_number = 93;
UPDATE matches SET placeholder_home = 'Winner M81', placeholder_away = 'Winner M82' WHERE match_number = 94;
UPDATE matches SET placeholder_home = 'Winner M86', placeholder_away = 'Winner M88' WHERE match_number = 95;
UPDATE matches SET placeholder_home = 'Winner M85', placeholder_away = 'Winner M87' WHERE match_number = 96;

-- QUARTERFINALS (97–100)
UPDATE matches SET placeholder_home = 'Winner M89', placeholder_away = 'Winner M90' WHERE match_number = 97;
UPDATE matches SET placeholder_home = 'Winner M93', placeholder_away = 'Winner M94' WHERE match_number = 98;
UPDATE matches SET placeholder_home = 'Winner M91', placeholder_away = 'Winner M92' WHERE match_number = 99;
UPDATE matches SET placeholder_home = 'Winner M95', placeholder_away = 'Winner M96' WHERE match_number = 100;

-- Reset knockout slot/result assignments (73–104): the previous values were entered
-- under the old, incorrect mapping and are now mismatched. The admin re-fills them
-- under the corrected bracket. Group-stage matches (1–72) and predictions are untouched.
UPDATE matches
SET home_team_id = NULL,
    away_team_id = NULL,
    home_score = NULL,
    away_score = NULL,
    home_penalties = NULL,
    away_penalties = NULL,
    winner_team_id = NULL,
    result_confirmed = false
WHERE match_number BETWEEN 73 AND 104;
