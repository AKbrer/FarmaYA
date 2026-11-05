from pymongo import MongoClient
from datetime import datetime
uri = "mongodb+srv://wilcabrera466_db_user:c4Ke99RB9CVCzrX1@cluster0.e2kxrlo.mongodb.net/?appName=Cluster0"
client = MongoClient(uri)
db = client['FarmaYA']
client_doc = db.clientes.find_one({"email": "wilcabrera466@gmail.com"})
if not client_doc:
    print('Client not found')
    exit(0)
client_id = str(client_doc['_id'])
orders = list(db.pedidos.find({"clientId": client_id}))
print('Total orders for client:', len(orders))
for o in orders:
    print(o.get('code'), o.get('status'))
