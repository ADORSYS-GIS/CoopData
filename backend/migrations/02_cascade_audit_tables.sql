SELECT conname, condeferrable, condeferred, confupdtype, confdeltype, convalidated 
FROM pg_constraint 
WHERE conrelid = 'users'::regclass AND contype = 'f';   