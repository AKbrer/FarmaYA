"""
FarmaYA - Generador Masivo de 10.000 Pedidos Históricos Completos y Movimientos Financieros
=======================================================================================
Puebla MongoDB con 10.000 pedidos completados exitosamente ('ENTREGADO'),
con consistencia contable, trazabilidad de repartidores, farmacias aliadas,
desglose de productos, cálculo del 10% de ganancia de FarmaYA, y registro
automático de cada transacción en la colección 'movimientos'.

Diseñado para generar la base histórica requerida para minería de datos y
entrenamiento de modelos predictivos de Machine Learning (KNN y Random Forest).
"""

import os
import random
import sys
from datetime import datetime, timedelta
from pymongo import MongoClient

# Conexión oficial FarmaYA (MongoDB Atlas)
MONGO_URI = os.getenv(
    "MONGODB_URI",
    "mongodb+srv://wilcabrera466_db_user:c4Ke99RB9CVCzrX1@cluster0.e2kxrlo.mongodb.net/?appName=Cluster0"
)
DATABASE_NAME = os.getenv("MONGODB_DATABASE", "FarmaYA")

# Catálogo completo de medicamentos y patrones de estacionalidad
MEDICAMENTOS = [
    # Alta rotación (Analgésicos, antipiréticos, vitaminas)
    {
        "name": "Ibuprofeno 800 mg",
        "category": "meds",
        "price": 14200,
        "base_prob": 0.88,
        "qty_range": (1, 4),
        "prescription": False,
        "high_season_months": [4, 5, 10, 11]  # Temporadas de lluvia/gripa
    },
    {
        "name": "Paracetamol 500 mg",
        "category": "meds",
        "price": 6500,
        "base_prob": 0.92,
        "qty_range": (1, 5),
        "prescription": False,
        "high_season_months": [3, 4, 10, 11]
    },
    {
        "name": "Vitamina C 1000 mg",
        "category": "vital",
        "price": 28900,
        "base_prob": 0.72,
        "qty_range": (1, 3),
        "prescription": False,
        "high_season_months": [5, 6, 11, 12]
    },
    {
        "name": "Ibuprofeno 400 mg",
        "category": "meds",
        "price": 8900,
        "base_prob": 0.78,
        "qty_range": (1, 3),
        "prescription": False,
        "high_season_months": [4, 5, 10, 11]
    },

    # Rotación moderada (Gástricos, antialérgicos, electrolitos)
    {
        "name": "Omeprazol 20 mg",
        "category": "gastro",
        "price": 9800,
        "base_prob": 0.48,
        "qty_range": (1, 2),
        "prescription": False,
        "high_season_months": [1, 7, 12]  # Temporadas festivas/gastronómicas
    },
    {
        "name": "Loratadina 10 mg",
        "category": "meds",
        "price": 7200,
        "base_prob": 0.42,
        "qty_range": (1, 3),
        "prescription": False,
        "high_season_months": [3, 4, 9, 10]
    },
    {
        "name": "Suero oral Electrolit Fresa",
        "category": "vital",
        "price": 8500,
        "base_prob": 0.38,
        "qty_range": (1, 4),
        "prescription": False,
        "high_season_months": [6, 7, 8, 1]  # Verano/calor
    },

    # Baja rotación / Especializados / Con receta médica
    {
        "name": "Amoxicilina 500 mg",
        "category": "meds",
        "price": 14500,
        "base_prob": 0.22,
        "qty_range": (1, 2),
        "prescription": True,
        "high_season_months": [5, 10]
    },
    {
        "name": "Protector solar FPS 50+ Facial",
        "category": "care",
        "price": 58500,
        "base_prob": 0.16,
        "qty_range": (1, 1),
        "prescription": False,
        "high_season_months": [12, 1, 6, 7]
    },
    {
        "name": "Losartán 50 mg",
        "category": "cardio",
        "price": 12000,
        "base_prob": 0.24,
        "qty_range": (1, 2),
        "prescription": True,
        "high_season_months": []
    },
    {
        "name": "Metformina 850 mg",
        "category": "metabolic",
        "price": 15000,
        "base_prob": 0.21,
        "qty_range": (1, 2),
        "prescription": True,
        "high_season_months": []
    },
    {
        "name": "Salbutamol Inhalador 100 mcg",
        "category": "respi",
        "price": 22000,
        "base_prob": 0.14,
        "qty_range": (1, 1),
        "prescription": True,
        "high_season_months": [4, 5, 10, 11]
    }
]

CLIENTES = [
    {"id": "cli-101", "name": "Camila Andrea Torres", "phone": "3002345678", "zone": "Zona Norte", "city": "Barranquilla"},
    {"id": "cli-102", "name": "Carlos Eduardo Mendoza", "phone": "3013456789", "zone": "Zona Centro", "city": "Barranquilla"},
    {"id": "cli-103", "name": "María José Rodríguez", "phone": "3104567890", "zone": "Zona Sur", "city": "Barranquilla"},
    {"id": "cli-104", "name": "Juan David Ospina", "phone": "3125678901", "zone": "Zona Oriente", "city": "Barranquilla"},
    {"id": "cli-105", "name": "Diana Carolina Morales", "phone": "3156789012", "zone": "Zona Occidente", "city": "Barranquilla"},
    {"id": "cli-106", "name": "Andrés Felipe Castro", "phone": "3207890123", "zone": "Zona Norte", "city": "Barranquilla"},
    {"id": "cli-107", "name": "Valentina Gómez Gil", "phone": "3008901234", "zone": "Zona Centro", "city": "Barranquilla"},
    {"id": "cli-108", "name": "Sebastián Rincón", "phone": "3149012345", "zone": "Zona Norte", "city": "Barranquilla"},
    {"id": "cli-109", "name": "Natalia Sofía Herrera", "phone": "3180123456", "zone": "Zona Sur", "city": "Barranquilla"},
    {"id": "cli-110", "name": "Mateo Alejandro Vargas", "phone": "3111234567", "zone": "Zona Occidente", "city": "Barranquilla"}
]

FARMACIAS = [
    {"id": "ph-01", "name": "Botica Central FarmaYA", "address": "Cra. 54 #72-105", "zone": "Zona Norte", "city": "Barranquilla", "lat": 11.0041, "lng": -74.8070},
    {"id": "ph-02", "name": "Droguería Vida y Salud", "address": "Calle 45 #33-21", "zone": "Zona Centro", "city": "Barranquilla", "lat": 10.9792, "lng": -74.7895},
    {"id": "ph-03", "name": "Farmacia La Riviera", "address": "Cra. 51B #84-40", "zone": "Zona Norte", "city": "Barranquilla", "lat": 11.0125, "lng": -74.8210},
    {"id": "ph-04", "name": "Droguería San Jorge", "address": "Calle 30 #20-15", "zone": "Zona Sur", "city": "Barranquilla", "lat": 10.9520, "lng": -74.7750}
]

REPARTIDORES = [
    {"id": "cr-01", "name": "Diego Armando Suárez", "phone": "3009876543", "vehicle": "Moto", "plate": "XYZ-45E"},
    {"id": "cr-02", "name": "Jhonatan Javier Morales", "phone": "3118765432", "vehicle": "Moto", "plate": "ABC-12F"},
    {"id": "cr-03", "name": "Luis Alberto Peñaloza", "phone": "3207654321", "vehicle": "Moto", "plate": "HJK-89D"},
    {"id": "cr-04", "name": "Álvaro José Barreto", "phone": "3156543210", "vehicle": "Carro", "plate": "RST-432"},
    {"id": "cr-05", "name": "Brayan Alexis Guzmán", "phone": "3045432109", "vehicle": "Moto", "plate": "QWE-90A"}
]

PAYMENT_METHODS = ["NEQUI", "PSE", "BANCOLOMBIA", "DAVIPLATA"]


def generate_10k_dataset(total_orders=10000, days_back=365):
    """
    Genera 10.000 pedidos distribuidos en los últimos 365 días con variaciones
    mensuales y semanales realistas para simular comportamiento auténtico de farmacias.
    """
    print(f"Generando {total_orders} pedidos con trazabilidad contable...")
    orders = []
    movements = []
    now = datetime.utcnow()

    for idx in range(1, total_orders + 1):
        # Distribución de fechas a lo largo de los últimos 365 días
        days_ago = random.randint(1, days_back)
        hours_ago = random.randint(7, 23)  # Horario comercial
        minutes_ago = random.randint(0, 59)
        order_date = now - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
        order_month = order_date.month

        # Selección de cliente, farmacia y repartidor
        client = random.choice(CLIENTES)
        # La farmacia preferentemente en la misma zona o cercana
        same_zone_pharmacies = [p for p in FARMACIAS if p["zone"] == client["zone"]]
        pharmacy = random.choice(same_zone_pharmacies) if same_zone_pharmacies else random.choice(FARMACIAS)
        courier = random.choice(REPARTIDORES)

        # Selección de items según probabilidad base y estacionalidad del mes
        items = []
        confirmed_items = []
        subtotal = 0.0

        for med in MEDICAMENTOS:
            prob = med["base_prob"]
            if order_month in med["high_season_months"]:
                prob = min(0.98, prob * 1.30)  # +30% de probabilidad en temporada alta

            if random.random() < prob:
                qty = random.randint(med["qty_range"][0], med["qty_range"][1])
                line_total = qty * med["price"]
                subtotal += line_total

                items.append({
                    "name": med["name"],
                    "quantity": qty,
                    "prescription": med["prescription"],
                    "note": ""
                })
                confirmed_items.append({
                    "name": med["name"],
                    "quantity": qty,
                    "unitPrice": float(med["price"]),
                    "available": True
                })

        # Asegurar al menos 1 medicamento si ninguno cayó por azar
        if not items:
            fallback = random.choice(MEDICAMENTOS)
            qty = random.randint(fallback["qty_range"][0], fallback["qty_range"][1])
            subtotal = qty * fallback["price"]
            items.append({
                "name": fallback["name"],
                "quantity": qty,
                "prescription": fallback["prescription"],
                "note": ""
            })
            confirmed_items.append({
                "name": fallback["name"],
                "quantity": qty,
                "unitPrice": float(fallback["price"]),
                "available": True
            })

        # Cálculo de distancias y tarifas según modelo FarmaYA
        dist_km = round(random.uniform(1.2, 8.5), 1)
        # Fórmula: Tarifa base $5.000 + $1.200 por km adicional después de 2 km
        courier_fee = float(5000 + int(max(0.0, dist_km - 2.0) * 1200))
        total_order = subtotal + courier_fee

        # Comisión del 10% de FarmaYA retenida sobre el subtotal de productos
        platform_earnings = round(subtotal * 0.10, 2)
        pharmacy_earnings = round(subtotal * 0.90, 2)

        code = f"ORD-{order_date.strftime('%Y%m')}-{idx:05d}"
        payment_method = random.choice(PAYMENT_METHODS)
        delivery_code = f"{random.randint(1000, 9999)}"

        prep_min = random.randint(15, 30)
        transit_min = random.randint(10, 25)
        picked_up_at = order_date + timedelta(minutes=prep_min)
        delivered_at = picked_up_at + timedelta(minutes=transit_min)

        # Documento completo del pedido
        order_doc = {
            "code": code,
            "clientId": client["id"],
            "clientName": client["name"],
            "clientPhone": client["phone"],
            "address": f"Calle {random.randint(10, 98)} #{random.randint(1, 65)}-{random.randint(1, 99)}",
            "zone": client["zone"],
            "city": client["city"],
            "notes": "Entregar en portería / timbre principal",
            "latitude": pharmacy["lat"] + random.uniform(-0.02, 0.02),
            "longitude": pharmacy["lng"] + random.uniform(-0.02, 0.02),
            "status": "ENTREGADO",
            "pharmacyId": pharmacy["id"],
            "pharmacyName": pharmacy["name"],
            "pharmacyAddress": pharmacy["address"],
            "pharmacyZone": pharmacy["zone"],
            "pharmacyLatitude": pharmacy["lat"],
            "pharmacyLongitude": pharmacy["lng"],
            "deliveryDistanceKm": dist_km,
            "courierEarnings": courier_fee,
            "items": items,
            "confirmedItems": confirmed_items,
            "total": float(total_order),
            "prepMinutes": prep_min,
            "pharmacyNote": "Medicamentos empacados y revisados por regente.",
            "courierId": courier["id"],
            "courierName": courier["name"],
            "courierPhone": courier["phone"],
            "paymentMethod": payment_method,
            "paymentStatus": "PAGADO_FARMAYA",
            "paymentTransactionId": f"TX-WOMPI-{order_date.strftime('%Y%m%d')}-{random.randint(100000, 999999)}",
            "platformCommissionRate": 0.10,
            "platformEarnings": platform_earnings,
            "deliveryCode": delivery_code,
            "codeAttempts": 1,
            "searchRound": 1,
            "courierRound": 1,
            "createdAt": order_date,
            "assignedAt": order_date + timedelta(minutes=3),
            "priceAskedAt": order_date + timedelta(minutes=5),
            "courierSearchStartedAt": order_date + timedelta(minutes=prep_min - 5),
            "updatedAt": delivered_at,
            "deliveredAt": delivered_at,
            "history": [
                {
                    "status": "SOLICITUD_ENVIADA",
                    "actorId": client["id"],
                    "actorName": client["name"],
                    "actorRole": "CLIENTE",
                    "note": "Solicitud creada desde la app",
                    "at": order_date
                },
                {
                    "status": "FARMACIA_ASIGNADA",
                    "actorId": pharmacy["id"],
                    "actorName": pharmacy["name"],
                    "actorRole": "FARMACIA",
                    "note": f"Asignada a {pharmacy['name']}",
                    "at": order_date + timedelta(minutes=3)
                },
                {
                    "status": "PRECIO_CONFIRMADO",
                    "actorId": pharmacy["id"],
                    "actorName": pharmacy["name"],
                    "actorRole": "FARMACIA",
                    "note": f"Precios confirmados (${subtotal:,.0f} COP)",
                    "at": order_date + timedelta(minutes=6)
                },
                {
                    "status": "REPARTIDOR_ASIGNADO",
                    "actorId": courier["id"],
                    "actorName": courier["name"],
                    "actorRole": "REPARTIDOR",
                    "note": f"Repartidor {courier['name']} ({courier['vehicle']} {courier['plate']}) aceptó",
                    "at": order_date + timedelta(minutes=12)
                },
                {
                    "status": "PEDIDO_RECOGIDO",
                    "actorId": courier["id"],
                    "actorName": courier["name"],
                    "actorRole": "REPARTIDOR",
                    "note": "Pedido recogido en droguería",
                    "at": picked_up_at
                },
                {
                    "status": "ENTREGADO",
                    "actorId": courier["id"],
                    "actorName": courier["name"],
                    "actorRole": "REPARTIDOR",
                    "note": f"Código {delivery_code} verificado con éxito",
                    "at": delivered_at
                }
            ]
        }
        orders.append(order_doc)

        # Registro contable y de auditoría en la colección 'movimientos'
        movement_doc = {
            "code": f"MOV-{order_date.strftime('%Y%m')}-{idx:05d}",
            "type": "PEDIDO_ENTREGADO",
            "description": (
                f"Pedido {code} entregado por {courier['name']} ({courier['vehicle']}). "
                f"Total: ${total_order:,.0f} COP | Farmacia: ${pharmacy_earnings:,.0f} COP | "
                f"Comisión FarmaYA (10%): ${platform_earnings:,.0f} COP | Domicilio: ${courier_fee:,.0f} COP"
            ),
            "orderCode": code,
            "actorId": courier["id"],
            "actorName": courier["name"],
            "actorRole": "REPARTIDOR",
            "createdAt": delivered_at
        }
        movements.append(movement_doc)

    return orders, movements


def insert_bulk_to_mongodb(total=10000, batch_size=1000):
    print("=" * 70)
    print("FarmaYA - Sembrador Masivo de 10.000 Pedidos y Movimientos en MongoDB")
    print("=" * 70)
    print(f"Conectando a MongoDB Atlas: {DATABASE_NAME}...")

    client = MongoClient(MONGO_URI)
    db = client[DATABASE_NAME]
    orders_col = db["pedidos"]
    movements_col = db["movimientos"]

    existing_orders = orders_col.count_documents({})
    existing_movs = movements_col.count_documents({})
    print(f"Estado actual de MongoDB:")
    print(f" - Pedidos existentes: {existing_orders}")
    print(f" - Movimientos existentes: {existing_movs}")

    orders, movements = generate_10k_dataset(total_orders=total, days_back=365)

    print(f"\nIniciando inserción por lotes de {batch_size} registros...")
    
    # Inserción en 'pedidos'
    for i in range(0, len(orders), batch_size):
        batch = orders[i:i + batch_size]
        orders_col.insert_many(batch)
        print(f" -> Insertados {min(i + batch_size, len(orders))}/{len(orders)} pedidos en 'pedidos'...")

    # Inserción en 'movimientos'
    for i in range(0, len(movements), batch_size):
        batch = movements[i:i + batch_size]
        movements_col.insert_many(batch)
        print(f" -> Insertados {min(i + batch_size, len(movements))}/{len(movements)} registros en 'movimientos'...")

    final_orders = orders_col.count_documents({})
    final_movs = movements_col.count_documents({})

    print("\n" + "=" * 70)
    print("¡Proceso completado exitosamente!")
    print(f"Total pedidos en colección 'pedidos': {final_orders}")
    print(f"Total movimientos en colección 'movimientos': {final_movs}")
    print("=" * 70)


if __name__ == "__main__":
    count = 10000
    if len(sys.argv) > 1:
        try:
            count = int(sys.argv[1])
        except ValueError:
            pass
    insert_bulk_to_mongodb(total=count)
