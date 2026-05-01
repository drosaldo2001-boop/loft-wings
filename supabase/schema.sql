-- ============================================
-- LOFT WINGS — Esquema completo de base de datos
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USUARIOS
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin','gerente','cajero','mesero','cocina','almacen')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MESAS
-- ============================================
CREATE TABLE IF NOT EXISTS mesas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero INTEGER UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  capacidad INTEGER DEFAULT 4,
  zona TEXT DEFAULT 'Interior',
  estado TEXT DEFAULT 'disponible' CHECK (estado IN ('disponible','ocupada','reservada','limpieza')),
  mesero_id UUID REFERENCES usuarios(id),
  cuenta_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTOS (MENU)
-- ============================================
CREATE TABLE IF NOT EXISTS productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  categoria TEXT NOT NULL CHECK (categoria IN ('alitas','hamburguesas','papas','bebidas','postres','extras')),
  precio DECIMAL(10,2) NOT NULL,
  costo DECIMAL(10,2) DEFAULT 0,
  imagen_url TEXT,
  activo BOOLEAN DEFAULT true,
  tiempo_prep_min INTEGER DEFAULT 15,
  ingredientes TEXT[] DEFAULT '{}',
  alergenos TEXT[] DEFAULT '{}',
  es_popular BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CUENTAS
-- ============================================
CREATE TABLE IF NOT EXISTS cuentas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mesa_id UUID REFERENCES mesas(id),
  mesero_id UUID NOT NULL REFERENCES usuarios(id),
  estado TEXT DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada','cancelada')),
  subtotal DECIMAL(10,2) DEFAULT 0,
  descuento DECIMAL(10,2) DEFAULT 0,
  impuesto DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  metodo_pago TEXT CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia','didi','uber','rappi')),
  plataforma TEXT DEFAULT 'local' CHECK (plataforma IN ('didi_food','uber_eats','rappi','local')),
  notas TEXT,
  factura_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cerrada_at TIMESTAMPTZ
);

-- FK circular: mesas -> cuentas
ALTER TABLE mesas ADD CONSTRAINT fk_mesa_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(id);

-- ============================================
-- PEDIDOS (items de cada cuenta)
-- ============================================
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuenta_id UUID NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10,2) NOT NULL,
  modificaciones TEXT[] DEFAULT '{}',
  notas TEXT,
  estado TEXT DEFAULT 'nuevo' CHECK (estado IN ('nuevo','en_preparacion','listo','entregado','cancelado')),
  tiempo_inicio TIMESTAMPTZ,
  tiempo_listo TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVENTARIO
-- ============================================
CREATE TABLE IF NOT EXISTS inventario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL,
  cantidad_actual DECIMAL(10,3) DEFAULT 0,
  cantidad_minima DECIMAL(10,3) DEFAULT 0,
  cantidad_optima DECIMAL(10,3) DEFAULT 0,
  costo_unitario DECIMAL(10,2) DEFAULT 0,
  proveedor TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MOVIMIENTOS DE INVENTARIO
-- ============================================
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventario_id UUID NOT NULL REFERENCES inventario(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','salida','ajuste','merma')),
  cantidad DECIMAL(10,3) NOT NULL,
  motivo TEXT NOT NULL,
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PEDIDOS DELIVERY (DiDi, Uber Eats, Rappi)
-- ============================================
CREATE TABLE IF NOT EXISTS pedidos_delivery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plataforma TEXT NOT NULL CHECK (plataforma IN ('didi_food','uber_eats','rappi','local')),
  id_externo TEXT NOT NULL,
  cliente_nombre TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10,2) DEFAULT 0,
  comision_plataforma DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  estado TEXT DEFAULT 'nuevo' CHECK (estado IN ('nuevo','en_preparacion','listo','entregado','cancelado')),
  direccion_entrega TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  entregado_at TIMESTAMPTZ
);

-- ============================================
-- REALTIME: habilitar para pedidos y mesas
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos_delivery;

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Usuario admin por defecto (password: admin123)
INSERT INTO usuarios (nombre, username, password_hash, rol) VALUES
  ('Administrador', 'admin', 'admin123', 'admin'),
  ('Gerente', 'gerente', 'gerente123', 'gerente'),
  ('Cajero Principal', 'cajero', 'cajero123', 'cajero'),
  ('Mesero 1', 'mesero1', 'mesero123', 'mesero'),
  ('Mesero 2', 'mesero2', 'mesero123', 'mesero'),
  ('Cocina', 'cocina', 'cocina123', 'cocina'),
  ('Almacen', 'almacen', 'almacen123', 'almacen')
ON CONFLICT (username) DO NOTHING;

-- Mesas (20 mesas)
INSERT INTO mesas (numero, nombre, capacidad, zona) VALUES
  (1, 'Mesa 1', 4, 'Interior'), (2, 'Mesa 2', 4, 'Interior'),
  (3, 'Mesa 3', 4, 'Interior'), (4, 'Mesa 4', 6, 'Interior'),
  (5, 'Mesa 5', 6, 'Interior'), (6, 'Mesa 6', 2, 'Interior'),
  (7, 'Mesa 7', 4, 'Terraza'), (8, 'Mesa 8', 4, 'Terraza'),
  (9, 'Mesa 9', 6, 'Terraza'), (10, 'Mesa 10', 4, 'Terraza'),
  (11, 'Mesa 11', 8, 'Terraza'), (12, 'Mesa 12', 4, 'Terraza'),
  (13, 'Barra 1', 2, 'Bar'), (14, 'Barra 2', 2, 'Bar'),
  (15, 'Barra 3', 2, 'Bar'), (16, 'Barra 4', 2, 'Bar'),
  (17, 'VIP 1', 8, 'VIP'), (18, 'VIP 2', 10, 'VIP'),
  (19, 'Reservas', 4, 'Interior'), (20, 'Eventos', 20, 'VIP')
ON CONFLICT (numero) DO NOTHING;

-- Menú Loft Wings
INSERT INTO productos (nombre, descripcion, categoria, precio, costo, tiempo_prep_min, ingredientes, alergenos, es_popular) VALUES
  ('Alitas Clásicas (6 pzas)', 'Alitas crujientes con tu salsa favorita', 'alitas', 129, 45, 15, ARRAY['alitas de pollo','aceite','harina'], ARRAY['gluten'], true),
  ('Alitas Clásicas (12 pzas)', 'Alitas crujientes con dos salsas', 'alitas', 219, 85, 18, ARRAY['alitas de pollo','aceite','harina'], ARRAY['gluten'], true),
  ('Alitas Clásicas (24 pzas)', 'La gran orden, perfecta para compartir', 'alitas', 399, 160, 22, ARRAY['alitas de pollo','aceite','harina'], ARRAY['gluten'], false),
  ('Boneless (6 pzas)', 'Trozos de pollo sin hueso, super crujientes', 'alitas', 109, 38, 12, ARRAY['pechuga de pollo','harina','huevo'], ARRAY['gluten','huevo'], true),
  ('Boneless (12 pzas)', 'Doble porción de boneless', 'alitas', 189, 72, 15, ARRAY['pechuga de pollo','harina','huevo'], ARRAY['gluten','huevo'], false),
  ('Burger Loft', 'Hamburguesa signature con doble carne, queso cheddar y salsa especial', 'hamburguesas', 149, 52, 12, ARRAY['carne de res','pan brioche','lechuga','tomate','cheddar'], ARRAY['gluten','lacteo'], true),
  ('Burger Pollo Crispy', 'Pechuga empanizada con mayonesa de chipotle', 'hamburguesas', 139, 48, 10, ARRAY['pechuga','pan brioche','chipotle','lechuga'], ARRAY['gluten','huevo'], false),
  ('Burger Doble BBQ', 'Doble carne con bacon y salsa BBQ casera', 'hamburguesas', 179, 68, 14, ARRAY['carne de res','bacon','cheddar','BBQ'], ARRAY['gluten','lacteo'], false),
  ('Papas Loft (porción)', 'Papas fritas con sazón especial', 'papas', 59, 15, 8, ARRAY['papa','aceite','especias'], ARRAY['gluten'], true),
  ('Papas con Queso', 'Papas con queso fundido y jalapeños', 'papas', 89, 22, 10, ARRAY['papa','queso cheddar','jalapeño'], ARRAY['lacteo'], false),
  ('Papas en Espiral', 'Papas tornado con aderezo ranch', 'papas', 79, 18, 12, ARRAY['papa','aceite','ranch'], ARRAY['lacteo'], false),
  ('Refresco', 'Coca-Cola, Sprite, Fanta (355ml)', 'bebidas', 35, 8, 1, ARRAY['refresco'], ARRAY[]::text[], false),
  ('Agua Natural', 'Agua embotellada 600ml', 'bebidas', 25, 5, 1, ARRAY['agua'], ARRAY[]::text[], false),
  ('Limonada Natural', 'Limonada fresca con hierbabuena', 'bebidas', 55, 12, 3, ARRAY['limón','agua','azúcar','hierbabuena'], ARRAY[]::text[], false),
  ('Agua de Jamaica', 'Agua fresca de Jamaica artesanal', 'bebidas', 45, 8, 2, ARRAY['jamaica','agua','azúcar'], ARRAY[]::text[], false),
  ('Cerveza Nacional', 'Corona, Modelo, Indio (355ml)', 'bebidas', 65, 20, 1, ARRAY['cerveza'], ARRAY['gluten'], false),
  ('Brownie con Helado', 'Brownie de chocolate caliente con helado de vainilla', 'postres', 89, 25, 5, ARRAY['chocolate','harina','huevo','helado'], ARRAY['gluten','lacteo','huevo'], false),
  ('Cheesecake', 'Cheesecake de frutos rojos', 'postres', 79, 20, 2, ARRAY['queso crema','galleta','frutos rojos'], ARRAY['gluten','lacteo'], false),
  ('Aderezo Extra', 'Ranch, Honey Mustard, Blue Cheese, Sriracha', 'extras', 15, 3, 1, ARRAY['aderezo'], ARRAY['lacteo'], false),
  ('Pan de Ajo', 'Pan tostado con mantequilla de ajo', 'extras', 35, 8, 5, ARRAY['pan','mantequilla','ajo'], ARRAY['gluten','lacteo'], false)
ON CONFLICT DO NOTHING;

-- Inventario base
INSERT INTO inventario (nombre, unidad, cantidad_actual, cantidad_minima, cantidad_optima, costo_unitario, proveedor) VALUES
  ('Alitas de Pollo', 'kg', 25, 10, 40, 85, 'Avícola del Norte'),
  ('Pechuga de Pollo', 'kg', 15, 5, 25, 75, 'Avícola del Norte'),
  ('Carne Molida de Res', 'kg', 12, 5, 20, 120, 'Carnicería Premium'),
  ('Pan Brioche', 'pieza', 48, 20, 80, 12, 'Panadería Artesanal'),
  ('Harina de Trigo', 'kg', 8, 3, 15, 18, 'Distribuidor Local'),
  ('Aceite Vegetal', 'lt', 12, 5, 20, 35, 'Distribuidora Alimentos'),
  ('Papa Blanca', 'kg', 30, 10, 50, 15, 'Verdulería Central'),
  ('Queso Cheddar', 'kg', 5, 2, 10, 145, 'Lácteos Premium'),
  ('Coca-Cola 355ml', 'pieza', 72, 24, 96, 8, 'FEMSA'),
  ('Cerveza Corona 355ml', 'pieza', 48, 12, 72, 18, 'Grupo Modelo'),
  ('Limón', 'kg', 3, 1, 8, 25, 'Verdulería Central'),
  ('Chocolate', 'kg', 2, 0.5, 4, 180, 'Proveedor Repostería'),
  ('Bacon', 'kg', 3, 1, 6, 165, 'Carnicería Premium'),
  ('Jalapeño', 'kg', 2, 0.5, 4, 45, 'Verdulería Central'),
  ('Mantequilla', 'kg', 2, 0.5, 4, 95, 'Lácteos Premium')
ON CONFLICT DO NOTHING;
