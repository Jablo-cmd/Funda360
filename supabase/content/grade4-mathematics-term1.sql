-- Funda360 content pack: Grade 4 Mathematics, Term 1 (vertical slice).
--
-- This is DATA, not a migration, so it never reaches production through `supabase db push`.
-- It is loaded by the RLS test harness, and a platform administrator may run it against a
-- database on purpose. Idempotent: if the version below already exists it does nothing.
--
-- Everything lands as `draft`. Nothing here is visible to teachers until a platform
-- administrator moves it draft -> review -> approved -> published with content_transition().
--
-- IMPORTANT (source and review): the topic structure and the objectives below are Funda360's own
-- plain-language draft mapping for the South African Intermediate Phase (Grade 4 Mathematics). They
-- are NOT copied from, and have NOT been verified against, the official DBE CAPS document. A
-- curriculum specialist must check them against the current official edition before approval.
-- No text from the curriculum PDF is reproduced here.

do $pack$
declare
  v_version  uuid;
  v_phase    uuid;
  v_grade    uuid;
  v_subject  uuid;
  v_gs       uuid;
  v_term     uuid;
  v_t_wn     uuid;
  v_t_add    uuid;
  v_t_frac   uuid;
  v_o_wn1    uuid;
  v_o_wn2    uuid;
  v_o_wn3    uuid;
  v_o_add1   uuid;
  v_o_add2   uuid;
  v_o_frac1  uuid;
  v_o_frac2  uuid;
  v_lesson1  uuid;
  v_lesson2  uuid;
  v_assess   uuid;
  v_q        uuid;
  v_res      uuid;
begin
  if exists (select 1 from public.curriculum_versions where code = 'ZA-CAPS-G4-MATH-SLICE') then
    raise notice 'content pack ZA-CAPS-G4-MATH-SLICE already loaded; nothing to do';
    return;
  end if;

  -- 1. Version ---------------------------------------------------------------------------
  insert into public.curriculum_versions (code, name, version_label, source, source_reference, license_notes)
  values ('ZA-CAPS-G4-MATH-SLICE', 'South African CAPS - Grade 4 Mathematics (Term 1 slice)', 'draft-1',
          'Department of Basic Education, South Africa (CAPS)',
          'Department of Basic Education official CAPS Mathematics Grades 4-6 (Intermediate Phase), © 2011, ISBN 978-1-4315-0491-6. Official source: https://www.education.gov.za/LinkClick.aspx?fileticket=dr7zg3CFCr8%3D&forcedownload=true&mid=1568&portalid=0&tabid=572',
          'Funda360 draft mapping and paraphrase. Not verified against the official document. Confirm permissions for any reproduction before approval. No CAPS text is copied.')
  returning id into v_version;

  insert into public.curriculum_phases (version_id, code, name, sort_order) values (v_version, 'IP', 'Intermediate Phase', 2)
  returning id into v_phase;
  insert into public.curriculum_grades (version_id, phase_id, grade_number, name, sort_order) values (v_version, v_phase, 4, 'Grade 4', 4)
  returning id into v_grade;
  insert into public.curriculum_subjects (version_id, code, name, language) values (v_version, 'MATH', 'Mathematics', 'en')
  returning id into v_subject;
  insert into public.curriculum_grade_subjects (version_id, grade_id, subject_id) values (v_version, v_grade, v_subject)
  returning id into v_gs;
  insert into public.curriculum_terms (version_id, grade_subject_id, term_number, weeks) values (v_version, v_gs, 1, 10)
  returning id into v_term;

  -- 2. Topics and objectives -------------------------------------------------------------
  insert into public.curriculum_topics (version_id, term_id, code, title, description, sort_order)
  values (v_version, v_term, 'G4.MATH.T1.WN', 'Whole numbers: counting, place value and comparing',
          'Working with whole numbers up to 10 000.', 1) returning id into v_t_wn;
  insert into public.curriculum_topics (version_id, term_id, code, title, description, sort_order)
  values (v_version, v_term, 'G4.MATH.T1.ADD', 'Addition and subtraction',
          'Adding and subtracting whole numbers with flexible strategies.', 2) returning id into v_t_add;
  insert into public.curriculum_topics (version_id, term_id, code, title, description, sort_order)
  values (v_version, v_term, 'G4.MATH.T1.FRAC', 'Common fractions',
          'Fractions as equal parts of a whole.', 3) returning id into v_t_frac;

  insert into public.curriculum_objectives (version_id, topic_id, code, description, sort_order, source_reference) values
    (v_version, v_t_wn, 'G4.MATH.T1.WN.01', 'Count forwards and backwards in different step sizes with whole numbers up to 10 000.', 1, 'Reviewer to map to official section')
  returning id into v_o_wn1;
  insert into public.curriculum_objectives (version_id, topic_id, code, description, sort_order, source_reference) values
    (v_version, v_t_wn, 'G4.MATH.T1.WN.02', 'Read, write and order whole numbers up to 10 000 using place value.', 2, 'Reviewer to map to official section')
  returning id into v_o_wn2;
  insert into public.curriculum_objectives (version_id, topic_id, code, description, sort_order, source_reference) values
    (v_version, v_t_wn, 'G4.MATH.T1.WN.03', 'Compare whole numbers up to 10 000 and use the symbols <, > and = correctly.', 3, 'Reviewer to map to official section')
  returning id into v_o_wn3;
  insert into public.curriculum_objectives (version_id, topic_id, code, description, sort_order, source_reference) values
    (v_version, v_t_add, 'G4.MATH.T1.ADD.01', 'Add and subtract whole numbers up to 10 000 using a range of strategies.', 1, 'Reviewer to map to official section')
  returning id into v_o_add1;
  insert into public.curriculum_objectives (version_id, topic_id, code, description, sort_order, source_reference) values
    (v_version, v_t_add, 'G4.MATH.T1.ADD.02', 'Solve word problems that involve addition and subtraction.', 2, 'Reviewer to map to official section')
  returning id into v_o_add2;
  insert into public.curriculum_objectives (version_id, topic_id, code, description, sort_order, source_reference) values
    (v_version, v_t_frac, 'G4.MATH.T1.FRAC.01', 'Recognise and name common fractions as equal parts of a whole.', 1, 'Reviewer to map to official section')
  returning id into v_o_frac1;
  insert into public.curriculum_objectives (version_id, topic_id, code, description, sort_order, source_reference) values
    (v_version, v_t_frac, 'G4.MATH.T1.FRAC.02', 'Recognise when two common fractions are equal, using diagrams or folding.', 2, 'Reviewer to map to official section')
  returning id into v_o_frac2;

  insert into public.curriculum_skills (version_id, objective_id, code, name) values
    (v_version, v_o_wn2, 'G4.MATH.T1.WN.02.S1', 'Name the value of each digit in a four-digit number'),
    (v_version, v_o_wn2, 'G4.MATH.T1.WN.02.S2', 'Write a number in expanded form'),
    (v_version, v_o_wn3, 'G4.MATH.T1.WN.03.S1', 'Choose the correct symbol (<, > or =)');

  -- 3. Lesson 1: Place value to 10 000 (full toolkit) ------------------------------------
  insert into public.lessons (curriculum_version_id, grade_subject_id, topic_id, title, description, estimated_minutes,
                              difficulty, teacher_notes, learner_instructions, sort_order, accessibility)
  values (v_version, v_gs, v_t_wn, 'Place value to 10 000',
          'Learners read, write and order four-digit numbers by understanding what each digit is worth.',
          45, 'standard',
          'Works with no projector and no devices: everything can be drawn on the board or printed. Start with the place value chart, then let learners build numbers with bundles or counters.',
          'Listen to your teacher, build the numbers with your group, then complete the practice set.',
          1, '{"reading_level":"Grade 4","offline_ready":true,"alt_text_required":true}'::jsonb)
  returning id into v_lesson1;

  insert into public.lesson_objectives (lesson_id, objective_id, curriculum_version_id, is_primary) values
    (v_lesson1, v_o_wn2, v_version, true),
    (v_lesson1, v_o_wn3, v_version, false);

  -- Teacher Toolkit resources: one separate, reusable piece per row.
  create temporary table pack_res (id uuid, title text, sort_order integer) on commit drop;
  with ins as (
    insert into public.teaching_resources
      (curriculum_version_id, grade_subject_id, topic_id, stage, resource_kind, title, summary, body, difficulty,
       estimated_minutes, delivery_formats, connectivity, device, projector_required, printable, cacheable, size_kb)
    values
    -- EXPLAIN
    (v_version, v_gs, v_t_wn, 'explain', 'teacher_explanation', 'What each digit is worth',
     'A short teacher script explaining ones, tens, hundreds and thousands.',
     '{"blocks":[{"type":"heading","text":"Say it in words"},{"type":"paragraph","text":"In the number 4 382 the digit 4 is in the thousands place, so it is worth 4 000. The 3 is worth 300, the 8 is worth 80 and the 2 is worth 2."},{"type":"steps","items":["Write 4 382 large on the board.","Point to each digit and ask: which place is this digit in?","Write the value under each digit: 4 000, 300, 80, 2.","Add the values together to show they make 4 382."]},{"type":"tip","text":"Say the place name every time: thousands, hundreds, tens, ones."}]}'::jsonb,
     'standard', 10, '{text,teacher_led}', 'none', 'teacher_device', false, true, true, 4),
    (v_version, v_gs, v_t_wn, 'explain', 'simplified_explanation', 'Place value in simple words',
     'A simpler explanation for learners who find the first one too fast.',
     '{"blocks":[{"type":"paragraph","text":"Think of a number as a row of boxes. Each box has a name: ones, tens, hundreds, thousands. A digit tells you how many of that box you have."},{"type":"paragraph","text":"In 2 305 we have 2 thousands, 3 hundreds, 0 tens and 5 ones."}]}'::jsonb,
     'foundational', 5, '{text,teacher_led}', 'none', 'teacher_device', false, true, true, 2),
    (v_version, v_gs, v_t_wn, 'explain', 'worked_example', 'Worked examples: 4 382 and 7 090',
     'Two examples, one with a zero, written out step by step.',
     '{"blocks":[{"type":"steps","items":["4 382 = 4 000 + 300 + 80 + 2","7 090 = 7 000 + 0 + 90 + 0 (the zero means there are no hundreds and no ones)","Check: 7 000 + 90 = 7 090"]}]}'::jsonb,
     'standard', 8, '{text}', 'none', 'teacher_device', false, true, true, 2),
    -- SHOW
    (v_version, v_gs, v_t_wn, 'show', 'diagram', 'Place value chart (draw on the board)',
     'How to draw the chart so every learner can see it. No projector needed.',
     '{"blocks":[{"type":"paragraph","text":"Draw four columns on the board and label them Th, H, T, O."},{"type":"table","headers":["Th","H","T","O"],"rows":[["4","3","8","2"]]},{"type":"tip","text":"Use a different chalk or marker colour for each column."}],"alt_text":"A place value chart with columns Th, H, T and O holding the digits 4, 3, 8 and 2."}'::jsonb,
     'standard', 5, '{visual,teacher_led}', 'none', 'none', false, true, true, 3),
    -- TRY
    (v_version, v_gs, v_t_wn, 'try', 'classroom_activity', 'Build a number with bundles',
     'Groups build a number with bundles of 10 sticks and loose sticks, or counters.',
     '{"blocks":[{"type":"paragraph","text":"Materials: bundles of sticks or bottle tops in groups of 10 and 100 (or drawn squares on paper)."},{"type":"steps","items":["Give each group a number card, for example 2 305.","The group shows the number with bundles and loose items.","Another group reads the number from the model.","Swap cards and repeat."]}]}'::jsonb,
     'standard', 15, '{practical,teacher_led}', 'none', 'none', false, false, true, 3),
    (v_version, v_gs, v_t_wn, 'try', 'group_activity', 'Place value card game',
     'Learners make digit cards from scrap paper and race to make the largest number.',
     '{"blocks":[{"type":"steps","items":["Each learner makes cards 0 to 9.","Draw four cards and arrange them to make the largest number.","Read the number aloud and write its expanded form.","Compare with a partner using <, > or =."]}]}'::jsonb,
     'standard', 15, '{practical,text}', 'none', 'none', false, false, true, 2),
    -- PRACTISE
    (v_version, v_gs, v_t_wn, 'practise', 'exercise', 'Practice set: read and write numbers',
     'Ten short questions on reading, writing and expanded form.',
     '{"blocks":[{"type":"numbered","items":["What is the value of the 4 in 3 407?","Write 6 000 + 200 + 50 + 1 as one number.","Write 8 090 in words.","Which digit is in the hundreds place in 9 216?","Write the number that is one more than 4 999."]}]}'::jsonb,
     'standard', 15, '{text,printable}', 'none', 'none', false, true, true, 3),
    (v_version, v_gs, v_t_wn, 'practise', 'differentiated_exercise', 'Practice set: numbers to 1 000 (support)',
     'The same skills with smaller numbers and a picture of the place value chart.',
     '{"blocks":[{"type":"numbered","items":["Write 352 in expanded form.","What is the value of the 5 in 352?","Write 400 + 60 + 7 as one number."]}]}'::jsonb,
     'foundational', 10, '{text,printable}', 'none', 'none', false, true, true, 2),
    (v_version, v_gs, v_t_wn, 'practise', 'differentiated_exercise', 'Practice set: puzzles with four-digit numbers',
     'Puzzles that need learners to reason about place value.',
     '{"blocks":[{"type":"numbered","items":["I am a four-digit number. My thousands digit is 6. My ones digit is double my hundreds digit. What could I be?","Write the largest and smallest number using the digits 7, 0, 4, 9 once each."]}]}'::jsonb,
     'advanced', 15, '{text,printable}', 'none', 'none', false, true, true, 2),
    -- CHECK
    (v_version, v_gs, v_t_wn, 'check', 'formative_questions', 'Questions to ask during the lesson',
     'Oral questions that show quickly who understands.',
     '{"blocks":[{"type":"numbered","items":["What is the value of the 7 in 7 420?","Is 3 905 more or less than 3 950? How do you know?","What number is 10 more than 4 380?"]},{"type":"tip","text":"Ask learners to show the answer with fingers or a written number on a slate, so everyone answers."}]}'::jsonb,
     'standard', 5, '{teacher_led}', 'none', 'none', false, false, true, 1),
    -- SUPPORT
    (v_version, v_gs, v_t_wn, 'support', 'remediation', 'Support: build numbers with counters',
     'A small-group activity for learners who are not yet secure with place value.',
     '{"blocks":[{"type":"steps","items":["Give each learner counters and a paper place value chart with ones, tens and hundreds.","Build 214 with 2 counters in hundreds, 1 in tens and 4 in ones.","Say the number and its expanded form together.","Change one counter and ask how the number changes."]}]}'::jsonb,
     'foundational', 15, '{practical,teacher_led}', 'none', 'none', false, false, true, 2),
    -- CHALLENGE
    (v_version, v_gs, v_t_wn, 'challenge', 'extension', 'Challenge: largest and smallest puzzles',
     'Reasoning puzzles for learners who have mastered the skill.',
     '{"blocks":[{"type":"numbered","items":["Using each of 2, 5, 8 and 1 once, write as many four-digit numbers as you can and order them.","Explain how you know which is largest without counting."]}]}'::jsonb,
     'advanced', 15, '{text}', 'none', 'none', false, false, true, 2),
    -- PRINT
    (v_version, v_gs, v_t_wn, 'print', 'worksheet', 'Printable worksheet: place value chart',
     'One page, black and white, prints cheaply.',
     '{"blocks":[{"type":"paragraph","text":"Fill in the place value chart for each number, then write the expanded form."},{"type":"table","headers":["Number","Th","H","T","O","Expanded form"],"rows":[["4 382","","","","",""],["7 090","","","","",""],["2 305","","","","",""],["9 999","","","","",""]]}]}'::jsonb,
     'standard', 15, '{printable,text}', 'none', 'none', false, true, true, 2),
    (v_version, v_gs, v_t_wn, 'print', 'teacher_resource', 'Teacher preparation checklist',
     'What to prepare before the lesson, with a low-cost materials list.',
     '{"blocks":[{"type":"steps","items":["Copy the printable worksheet (one per pair is enough).","Collect bottle tops or sticks in bundles of 10.","Prepare the number cards 0 to 9.","Draw the place value chart on the board before learners arrive."]}]}'::jsonb,
     'standard', 10, '{printable,text}', 'none', 'none', false, true, true, 2)
    returning id, title
  )
  insert into pack_res (id, title) select id, title from ins;

  insert into public.lesson_resources (lesson_id, resource_id, curriculum_version_id, sort_order)
  select v_lesson1, r.id, v_version, row_number() over (order by r.title) from pack_res r;
  insert into public.resource_objectives (resource_id, objective_id, curriculum_version_id)
  select r.id, o, v_version from pack_res r cross join (values (v_o_wn2), (v_o_wn3)) as t(o);

  insert into public.learning_activities (lesson_id, curriculum_version_id, title, instructions, activity_type, grouping, difficulty, estimated_minutes, resource_id, sort_order)
  values
    (v_lesson1, v_version, 'Build and read numbers', 'In groups, build each number card with bundles, then read it aloud to the class.', 'group_work', 'small_group', 'standard', 15,
      (select id from pack_res where title = 'Build a number with bundles'), 1),
    (v_lesson1, v_version, 'Practice set', 'Complete the practice set on your own. Choose the set your teacher gives you.', 'individual_practice', 'individual', 'standard', 15,
      (select id from pack_res where title = 'Practice set: read and write numbers'), 2),
    (v_lesson1, v_version, 'Largest number race', 'With a partner, make the largest number you can from four cards and compare using <, > or =.', 'game', 'pair', 'standard', 10,
      (select id from pack_res where title = 'Place value card game'), 3);

  -- Quick check (assessment) with answer keys --------------------------------------------
  insert into public.learning_assessments (curriculum_version_id, grade_subject_id, topic_id, lesson_id, title, purpose, estimated_minutes, mastery_percent, support_below_percent)
  values (v_version, v_gs, v_t_wn, v_lesson1, 'Quick check: place value to 10 000', 'formative', 10, 80, 50)
  returning id into v_assess;
  insert into public.assessment_objectives (assessment_id, objective_id, curriculum_version_id) values
    (v_assess, v_o_wn2, v_version), (v_assess, v_o_wn3, v_version);

  insert into public.assessment_questions (assessment_id, curriculum_version_id, position, question_type, prompt, options, marks, objective_id)
  values (v_assess, v_version, 1, 'multiple_choice', 'What is the value of the 7 in 3 745?', '["7","70","700","7 000"]'::jsonb, 1, v_o_wn2) returning id into v_q;
  insert into public.assessment_question_keys (question_id, assessment_id, answer, feedback) values (v_q, v_assess, '"700"'::jsonb, 'The 7 is in the hundreds place.');

  insert into public.assessment_questions (assessment_id, curriculum_version_id, position, question_type, prompt, marks, objective_id)
  values (v_assess, v_version, 2, 'numeric', 'Write 6 000 + 200 + 50 + 1 as one number.', 1, v_o_wn2) returning id into v_q;
  insert into public.assessment_question_keys (question_id, assessment_id, answer, feedback) values (v_q, v_assess, '6251'::jsonb, 'Add the thousands, hundreds, tens and ones.');

  insert into public.assessment_questions (assessment_id, curriculum_version_id, position, question_type, prompt, options, marks, objective_id)
  values (v_assess, v_version, 3, 'multiple_choice', 'Which symbol makes this true: 4 380 __ 4 308?', '["<",">","="]'::jsonb, 1, v_o_wn3) returning id into v_q;
  insert into public.assessment_question_keys (question_id, assessment_id, answer, feedback) values (v_q, v_assess, '">"'::jsonb, '4 380 has 8 tens; 4 308 has 0 tens.');

  insert into public.assessment_questions (assessment_id, curriculum_version_id, position, question_type, prompt, marks, objective_id)
  values (v_assess, v_version, 4, 'true_false', 'True or false: 5 099 is greater than 5 100.', 1, v_o_wn3) returning id into v_q;
  insert into public.assessment_question_keys (question_id, assessment_id, answer, feedback) values (v_q, v_assess, 'false'::jsonb, 'Compare the hundreds: 0 is less than 1.');

  insert into public.assessment_questions (assessment_id, curriculum_version_id, position, question_type, prompt, marks, objective_id)
  values (v_assess, v_version, 5, 'short_answer', 'Put in order from smallest to largest: 2 090, 2 009, 2 900.', 2, v_o_wn2) returning id into v_q;
  insert into public.assessment_question_keys (question_id, assessment_id, answer, feedback, marking_notes)
  values (v_q, v_assess, '["2 009","2 090","2 900"]'::jsonb, 'Compare the hundreds first, then the tens.', 'One mark for two in the right order, two marks for all three.');

  -- 4. Lesson 2: Adding and subtracting with a number line (lighter toolkit) -------------
  insert into public.lessons (curriculum_version_id, grade_subject_id, topic_id, title, description, estimated_minutes, difficulty, teacher_notes, sort_order, accessibility)
  values (v_version, v_gs, v_t_add, 'Adding and subtracting with a number line',
          'Learners add and subtract by jumping on an empty number line.', 40, 'standard',
          'Draw the number line on the board. No devices needed.', 2, '{"reading_level":"Grade 4","offline_ready":true}'::jsonb)
  returning id into v_lesson2;
  insert into public.lesson_objectives (lesson_id, objective_id, curriculum_version_id, is_primary) values (v_lesson2, v_o_add1, v_version, true);

  insert into public.teaching_resources
    (curriculum_version_id, grade_subject_id, topic_id, stage, resource_kind, title, summary, body, delivery_formats, connectivity, device, printable)
  values
    (v_version, v_gs, v_t_add, 'explain', 'teacher_explanation', 'Jumping on a number line',
     'Show addition and subtraction as jumps: 4 000 + 300 + 50 by jumping 4 000, then 300, then 50.',
     '{"blocks":[{"type":"steps","items":["Draw an empty number line and mark the start number.","Jump by thousands, then hundreds, then tens, then ones.","Write each jump above the line and the landing number below it."]}]}'::jsonb,
     '{text,teacher_led}', 'none', 'teacher_device', true)
  returning id into v_res;
  insert into public.lesson_resources (lesson_id, resource_id, curriculum_version_id, sort_order) values (v_lesson2, v_res, v_version, 1);
  insert into public.resource_objectives (resource_id, objective_id, curriculum_version_id) values (v_res, v_o_add1, v_version);

  raise notice 'content pack ZA-CAPS-G4-MATH-SLICE loaded as draft (version %)', v_version;
end
$pack$;
