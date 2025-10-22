-- Enable realtime for client_assets table
ALTER TABLE client_assets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE client_assets;