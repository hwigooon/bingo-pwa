alter table public.games
  add column if not exists target_bingo_count integer not null default 1 check (target_bingo_count between 1 and 14),
  add column if not exists winner_user_id uuid references auth.users(id) on delete set null;

create or replace function public.submit_bingo_turn(target_game_id uuid, called_word text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_game public.games%rowtype;
  active_player public.game_players%rowtype;
  participant public.game_players%rowtype;
  next_user_id uuid;
  next_marks jsonb;
  previous_bingos integer;
  next_bingos integer;
  row_index integer;
  column_index integer;
  diagonal_complete boolean;
  winning_user_id uuid;
  winning_nickname text;
  winning_bingo_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if called_word is null or btrim(called_word) = '' or char_length(called_word) > 30 then
    raise exception 'invalid word';
  end if;

  select * into target_game from public.games where id = target_game_id for update;
  if not found or target_game.status <> 'playing' then raise exception 'game is not playing'; end if;
  if target_game.current_turn_user_id is distinct from auth.uid() then raise exception 'not your turn'; end if;
  if target_game.called_words ? called_word then raise exception 'already called'; end if;

  select * into active_player
  from public.game_players
  where game_id = target_game_id and user_id = auth.uid();

  if not found or not (active_player.board ? called_word) then raise exception 'word is not on your board'; end if;

  for participant in
    select * from public.game_players where game_id = target_game_id order by joined_at, id
  loop
    previous_bingos := participant.bingo_count;
    select coalesce(jsonb_agg(mark_index order by mark_index), '[]'::jsonb)
      into next_marks
    from (
      select distinct mark_index
      from (
        select (value::text)::integer as mark_index
        from jsonb_array_elements(participant.marked_cells)
        union all
        select (ordinality - 1)::integer
        from jsonb_array_elements_text(participant.board) with ordinality
        where value = called_word
      ) all_marks
    ) unique_marks;

    next_bingos := 0;
    for row_index in 0..target_game.board_size - 1 loop
      if not exists (
        select 1 from generate_series(0, target_game.board_size - 1) as col
        where not (next_marks @> to_jsonb(row_index * target_game.board_size + col))
      ) then next_bingos := next_bingos + 1; end if;
    end loop;
    for column_index in 0..target_game.board_size - 1 loop
      if not exists (
        select 1 from generate_series(0, target_game.board_size - 1) as row_num
        where not (next_marks @> to_jsonb(row_num * target_game.board_size + column_index))
      ) then next_bingos := next_bingos + 1; end if;
    end loop;
    diagonal_complete := true;
    for row_index in 0..target_game.board_size - 1 loop
      if not (next_marks @> to_jsonb(row_index * target_game.board_size + row_index)) then diagonal_complete := false; end if;
    end loop;
    if diagonal_complete then next_bingos := next_bingos + 1; end if;
    diagonal_complete := true;
    for row_index in 0..target_game.board_size - 1 loop
      if not (next_marks @> to_jsonb(row_index * target_game.board_size + (target_game.board_size - row_index - 1))) then diagonal_complete := false; end if;
    end loop;
    if diagonal_complete then next_bingos := next_bingos + 1; end if;

    update public.game_players
    set marked_cells = next_marks, bingo_count = next_bingos
    where id = participant.id;

    if next_bingos >= target_game.target_bingo_count and winning_user_id is null then
      winning_user_id := participant.user_id;
      winning_nickname := participant.nickname;
      winning_bingo_count := next_bingos;
    end if;

    if next_bingos > previous_bingos then
      insert into public.game_events(game_id, user_id, nickname, event_type, payload)
      values (target_game_id, participant.user_id, participant.nickname, 'bingo', jsonb_build_object('bingoCount', next_bingos));
    end if;
  end loop;

  if winning_user_id is not null then
    update public.games
    set status = 'finished',
        ended_at = now(),
        winner_user_id = winning_user_id,
        current_turn_user_id = null,
        called_words = called_words || jsonb_build_array(called_word)
    where id = target_game_id;

    insert into public.game_events(game_id, user_id, nickname, event_type, payload)
    values (target_game_id, winning_user_id, winning_nickname, 'finished',
      jsonb_build_object('winnerUserId', winning_user_id, 'bingoCount', winning_bingo_count));
  else
    select user_id into next_user_id
    from public.game_players
    where game_id = target_game_id
      and (joined_at, id) > (active_player.joined_at, active_player.id)
    order by joined_at, id
    limit 1;

    if next_user_id is null then
      select user_id into next_user_id
      from public.game_players
      where game_id = target_game_id
      order by joined_at, id
      limit 1;
    end if;

    update public.games
    set current_turn_user_id = next_user_id,
        turn_number = turn_number + 1,
        called_words = called_words || jsonb_build_array(called_word)
    where id = target_game_id;
  end if;

  insert into public.game_events(game_id, user_id, nickname, event_type, payload)
  values (
    target_game_id,
    auth.uid(),
    active_player.nickname,
    'called',
    jsonb_build_object('word', called_word, 'turnNumber', target_game.turn_number)
  );
end;
$$;

revoke all on function public.submit_bingo_turn(uuid, text) from public;
grant execute on function public.submit_bingo_turn(uuid, text) to authenticated;


revoke execute on function public.submit_bingo_turn(uuid, text) from anon;
grant execute on function public.submit_bingo_turn(uuid, text) to authenticated;
create index if not exists games_winner_user_id_idx on public.games(winner_user_id);
