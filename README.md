This is a EXTREMELY simple working Duinocoin faucet in HTML and javascript. It requires you to have a Supabase account to do the cooldown because static sites cant write to files like all of the rest of my faucets.
This is MOST LIKELY going to set the kolka after you so use CAREFULLY. It is not my fault if you get your account under supension and stuff. Just change the config file to your username and also make sure to set the write stuff in your supabase 
thingies. create a new table in supabase with this 

create table cooldowns (
    username text primary key,
    timestamp bigint not null
);


and then make sure to add your supabase project url and ANON key which you can find in project settings > api
