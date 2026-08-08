CREATE FUNCTION assert_batch_balanced() RETURNS trigger AS $$
DECLARE
  offending record;
BEGIN
  SELECT currency,
         sum(amount_minor_units) FILTER (WHERE direction = 'debit')  AS debits,
         sum(amount_minor_units) FILTER (WHERE direction = 'credit') AS credits
    INTO offending
    FROM journal_entries
   WHERE batch_id = NEW.batch_id
   GROUP BY currency
  HAVING coalesce(sum(amount_minor_units) FILTER (WHERE direction = 'debit'), 0)
       <> coalesce(sum(amount_minor_units) FILTER (WHERE direction = 'credit'), 0)
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'unbalanced posting batch % in %: debits=% credits=%',
      NEW.batch_id, offending.currency, coalesce(offending.debits, 0), coalesce(offending.credits, 0);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_entries_balanced
  AFTER INSERT ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION assert_batch_balanced();
