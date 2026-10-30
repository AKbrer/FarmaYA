"""
FarmaYA - Generador de Registros Históricos de Pedidos para Entrenamiento de ML
Puebla la colección 'pedidos' de MongoDB con datos históricos realistas de 6 a 12 meses atrás
para simular demanda variable (alta, media y baja) por medicamento.
"""

import os
import random
from datetime import datetime, timedelta
from pymongo import MongoClient

# Conexión por defecto (Atlas o local)
MONGO_URI = os.getenv(
    "MONGODB_URI",
    "mongodb+srv://wilcabrera466_db_user:c4Ke99RB9CVCzrX1@cluster0.e2kxrlo.mongodb.net/?appName=Cluster0"
)
DATABASE_NAME = os.getenv("MONGODB_DATABASE", "FarmaYA")

# Medicamentos del catálogo con sus patrones de demanda típicos
MEDICAMENTOS = [
    # Medicamentos de alta demanda (analgésicos comunes, vitaminas populares)
    {"name": "Ibuprofeno 800 mg", "base_prob": 0.85, "qty_range": (1, 4), "price": 14200, "rx": False},
    {"name": "Paracetamol 500 mg", "base_prob": 0.90, "qty_range": (1, 5), "price": 6500, "rx": False},
    {"name": "Ibuprofeno 400 mg", "base_prob": 0.75, "qty_range": (1, 3), "price": 8900, "rx": False},
    {"name": "Vitamina C 1000 mg", "base_prob": 0.70, "qty_range": (1, 3), "price": 28900, "rx": False},
    
    # Medicamentos de demanda media (gástricos, antialérgicos, electrolitos)
    {"name": "Omeprazol 20 mg", "base_prob": 0.45, "qty_range": (1, 2), "price": 9800, "rx": False},
    {"name": "Loratadina 10 mg", "base_prob": 0.40, "qty_range": (1, 3), "price": 7200, "rx": False},
    {"name": "Suero oral Electrolit Fresa", "base_prob": 0.35, "qty_range": (1, 3), "price": 8500, "rx": False},
    
    # Medicamentos de baja demanda / especializados o con receta
    {"name": "Amoxicilina 500 mg", "base_prob": 0.18, "qty_range": (1, 2), "price": 14500, "rx": True},
    {"name": "Protector solar FPS 50+ Facial", "base_prob": 0.15, "qty_range": (1, 1), "price": 58500, "rx": False},
    {"name": "Losartán 50 mg", "base_prob": 0.22, "qty_range": (1, 2), "price": 12000, "rx": True},
    {"name": "Metformina 850 mg", "base_prob": 0.20, "qty_range": (1, 2), "price": 15000, "rx": True},
    {"name": "Salbutamol Inhalador 100 mcg", "base_prob": 0.12, "qty_range": (1, 1), "price": 22000, "rx": True}
]

ZONAS = ["Zona Norte", "Zona Centro", "Zona Sur", "Zona Oriente", "Zona Occidente"]

CLIENTES = [
    {"id": "c1", "name": "Camila Torres", "phone": "3001112233"},
    {"id": "c2", "name": "Carlos Mendoza", "phone": "3002223344"},
    {"id": "c3", "name": "María Rodríguez", "phone": "3003334455"},
    {"id": "c4", "name": "Juan David Ospina", "phone": "3004445566"},
    {"id": "c5", "name": "Diana Morales", "phone": "3005556677"}
]

FARMACIAS = [
    {"id": "f1", "name": "Botica Central", "zone": "Zona Norte"},
    {"id": "f2", "name": "Droguería Vida", "zone": "Zona Centro"}
]

def generate_orders(num_orders=350, months_back=6):
    """Genera pedidos distribuidos en los últimos N meses."""
    orders = []
    now = datetime.utcnow()
    
    for i in range(1, num_orders + 1):
        # Seleccionar fecha al azar en los últimos N meses
        days_ago = random.randint(1, months_back * 30)
        order_date = now - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        
        # Cliente y farmacia
        client = random.choice(CLIENTES)
        pharmacy = random.choice(FARMACIAS)
        zone = pharmacy["zone"]
        
        # Seleccionar medicamentos para este pedido según su probabilidad de demanda
        chosen_items = []
        confirmed_items = []
        total = 0.0
        
        for med in MEDICAMENTOS:
            if random.random() < med["base_prob"]:
                qty = random.randint(med["qty_range"][0], med["qty_range"][1])
                subtotal = qty * med["price"]
                total += subtotal
                
                chosen_items.append({
                    "name": med["name"],
                    "quantity": qty,
                    "prescription": med["rx"],
                    "note": ""
                })
                confirmed_items.append({
                    "name": med["name"],
                    "quantity": qty,
                    "unitPrice": float(med["price"]),
                    "available": True
                })
        
        # Asegurar al menos 1 producto por pedido
        if not chosen_items:
            med = random.choice(MEDICAMENTOS)
            qty = random.randint(med["qty_range"][0], med["qty_range"][1])
            total = qty * med["price"]
            chosen_items.append({
                "name": med["name"],
                "quantity": qty,
                "prescription": med["rx"],
                "note": ""
            })
            confirmed_items.append({
                "name": med["name"],
                "quantity": qty,
                "unitPrice": float(med["price"]),
                "available": True
            })
            
        code = f"HIST-{order_date.strftime('%Y%m')}-{i:04d}"
        
        order_doc = {
            "code": code,
            "clientId": client["id"],
            "clientName": client["name"],
            "clientPhone": client["phone"],
            "address": f"Calle {random.randint(10, 150)} #{random.randint(1, 99)}-{random.randint(1, 99)}",
            "zone": zone,
            "city": "Bogotá",
            "status": "ENTREGADO",
            "pharmacyId": pharmacy["id"],
            "pharmacyName": pharmacy["name"],
            "pharmacyZone": pharmacy["zone"],
            "items": chosen_items,
            "confirmedItems": confirmed_items,
            "total": float(total),
            "paymentMethod": "NEQUI",
            "paymentStatus": "PAGADO_FARMAYA",
            "createdAt": order_date,
            "updatedAt": order_date + timedelta(minutes=random.randint(25, 45)),
            "deliveredAt": order_date + timedelta(minutes=random.randint(25, 45)),
            "history": [
                {"status": "CREADO", "at": order_date, "by": client["name"], "note": "Pedido creado"},
                {"status": "ENTREGADO", "at": order_date + timedelta(minutes=35), "by": "Repartidor", "note": "Entrega completada"}
            ]
        }
        orders.append(order_doc)
        
    return orders

def seed_to_mongodb():
    print(f"Conectando a MongoDB en: {DATABASE_NAME}...")
    client = MongoClient(MONGO_URI)
    db = client[DATABASE_NAME]
    orders_col = db["pedidos"]
    
    # Revisar si ya existen pedidos históricos generados
    existing_count = orders_col.count_documents({"code": {"$regex": "^HIST-"}})
    if existing_count > 0:
        print(f"Ya existen {existing_count} pedidos históricos de prueba con prefijo 'HIST-'.")
        choice = input("¿Deseas recrearlos o agregar más? (s/n): ").strip().lower()
        if choice != 's':
            print("Operación cancelada. Conservando pedidos existentes.")
            return
        orders_col.delete_many({"code": {"$regex": "^HIST-"}})
        print("Registros históricos previos eliminados.")
        
    orders = generate_orders(num_orders=450, months_back=6)
    result = orders_col.insert_many(orders)
    print(f"Se insertaron exitosamente {len(result.inserted_ids)} pedidos históricos en la colección 'pedidos'.")

if __name__ == "__main__":
    seed_to_mongodb()
