revoke execute on function public.is_game_member(uuid) from anon;
revoke execute on function public.submit_bingo_turn(uuid, text) from anon;
grant execute on function public.is_game_member(uuid) to authenticated;
grant execute on function public.submit_bingo_turn(uuid, text) to authenticated;

create index if not exists games_current_turn_user_id_idx on public.games(current_turn_user_id);
