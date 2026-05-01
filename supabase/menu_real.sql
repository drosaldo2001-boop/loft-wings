-- ============================================
-- MENÚ REAL LOFT WINGS + PROMOCIONES
-- ============================================

-- 1. Actualizar categorías permitidas
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_categoria_check;
ALTER TABLE productos ADD CONSTRAINT productos_categoria_check
  CHECK (categoria IN ('alitas','boneless','hamburguesas','ensaladas','antojitos','desayunos','bebidas','postres','extras'));

-- 2. Limpiar menú demo
DELETE FROM pedidos;
DELETE FROM cuentas;
UPDATE mesas SET estado = 'disponible', cuenta_id = NULL, mesero_id = NULL;
DELETE FROM productos;

-- 3. Crear tabla de promociones
CREATE TABLE IF NOT EXISTS promociones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  dia_semana TEXT CHECK (dia_semana IN ('lunes','martes','miercoles','jueves','viernes','sabado','domingo','siempre')),
  precio DECIMAL(10,2),
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE promociones DISABLE ROW LEVEL SECURITY;

-- 4. Insertar menú real
INSERT INTO productos (nombre, descripcion, categoria, precio, tiempo_prep_min, ingredientes, alergenos, es_popular) VALUES

-- ALITAS
('Alitas 10 pz', '10 piezas crujientes. Hasta 1 sabor. Incluye aderezo Ranch. Salsas: Buffalo, BBQ, Mango Habanero, Honey Garlic, Parmesan, Lemon Pepper, Korean BBQ, Chipotle.', 'alitas', 190, 18, ARRAY['alitas de pollo','aceite','especias'], ARRAY[]::text[], true),
('Alitas 20 pz', '20 piezas crujientes. Hasta 3 sabores. Incluye aderezo Ranch.', 'alitas', 340, 22, ARRAY['alitas de pollo','aceite','especias'], ARRAY[]::text[], true),
('Alitas 30 pz', '30 piezas crujientes. Hasta 4 sabores. Incluye aderezo Ranch.', 'alitas', 490, 28, ARRAY['alitas de pollo','aceite','especias'], ARRAY[]::text[], false),
('Alitas 40 pz', '40 piezas crujientes. Hasta 4 sabores. Incluye aderezo Ranch.', 'alitas', 640, 32, ARRAY['alitas de pollo','aceite','especias'], ARRAY[]::text[], false),
('Alitas 50 pz', '50 piezas crujientes. Hasta 4 sabores. Incluye aderezo Ranch.', 'alitas', 790, 38, ARRAY['alitas de pollo','aceite','especias'], ARRAY[]::text[], false),

-- BONELESS
('Boneless 250 gr', 'Receta original Loft Wings, hechas al momento. Pechuga de pollo. 1 sabor. Incluye aderezo Ranch.', 'boneless', 190, 15, ARRAY['pechuga de pollo','harina','huevo'], ARRAY['gluten','huevo'], true),
('Boneless 500 gr', 'Receta original Loft Wings, hechas al momento. Pechuga de pollo. 2 sabores. Incluye aderezo Ranch.', 'boneless', 340, 20, ARRAY['pechuga de pollo','harina','huevo'], ARRAY['gluten','huevo'], true),

-- LOFT BURGERS
('Smash Cheese', 'Carne smash 140gr 100% res 85/15, pan brioche, queso americano, aderezo de la casa, jitomate, lechuga, pepinillos, cebolla.', 'hamburguesas', 160, 12, ARRAY['carne de res','pan brioche','queso americano','lechuga','jitomate'], ARRAY['gluten','lacteo'], true),
('Smash Chicken', 'Boneless, queso gouda, tocino premium. Pan brioche, aderezo de la casa, jitomate, lechuga, pepinillos, cebolla.', 'hamburguesas', 160, 12, ARRAY['pechuga de pollo','pan brioche','queso gouda','tocino'], ARRAY['gluten','lacteo'], false),
('Smash Burger', 'Carne smash 140gr 100% res 85/15, queso gouda, tocino premium. Pan brioche.', 'hamburguesas', 220, 14, ARRAY['carne de res','pan brioche','queso gouda','tocino'], ARRAY['gluten','lacteo'], true),
('Smash Burger Special', 'Carne smash, queso gouda, tocino premium y salsa a elegir. Pan brioche.', 'hamburguesas', 250, 14, ARRAY['carne de res','pan brioche','queso gouda','tocino'], ARRAY['gluten','lacteo'], false),
('Smash Burger Doble', 'Doble queso gouda, doble queso americano, doble carne smash y tocino premium. Pan brioche.', 'hamburguesas', 290, 16, ARRAY['carne de res','pan brioche','queso gouda','queso americano','tocino'], ARRAY['gluten','lacteo'], false),
('Hamburguesa Baby con Papas', 'Hamburguesa pequeña con papas a la francesa.', 'hamburguesas', 98, 10, ARRAY['carne de res','pan brioche','papa'], ARRAY['gluten'], false),

-- ENSALADAS
('Ensalada César', 'Mix de lechugas, tomate cherry, crutones, tiras de pollo empanizado, queso parmesano y aderezo césar. Bowl 32 Oz.', 'ensaladas', 110, 10, ARRAY['lechuga','tomate cherry','pollo','queso parmesano','crutones'], ARRAY['gluten','lacteo'], true),
('Green Salad', 'Mix de lechugas, espinacas baby, champiñones fileteados, tomate cherry, crutones, aderezo honey mustard. Bowl 32 Oz.', 'ensaladas', 90, 8, ARRAY['lechuga','espinacas','champiñones','tomate cherry','crutones'], ARRAY['gluten'], false),

-- ANTOJITOS
('Pozole', 'Pollo, cerdo o cabeza. Blanco (de Blanca) o Rojo (de Gloria). Con salsa de la casa, lechuga, rábanos, cebolla, orégano y tostadas de El Trigal.', 'antojitos', 78, 5, ARRAY['maíz','caldo','pollo','cerdo'], ARRAY[]::text[], true),
('Flautas (3 pzas)', '3 piezas con lechuga, queso y crema. Rellenas: pollo, papa con chorizo o carne.', 'antojitos', 48, 10, ARRAY['tortilla','pollo','queso','crema','lechuga'], ARRAY['lacteo'], false),
('Tacos', 'En tortilla de harina o maíz. Bisteck, costilla, arrachera o chorizo. Con queso +$18.', 'antojitos', 28, 8, ARRAY['tortilla','carne','cebolla','cilantro'], ARRAY[]::text[], true),
('Huarache', 'Con frijoles, lechuga, queso, crema y salsa roja o verde. Proteína: pechuga +$18, bisteck +$18, arrachera +$28, huevo +$8, chorizo +$8, queso +$8.', 'antojitos', 48, 12, ARRAY['masa','frijoles','queso','crema','lechuga'], ARRAY['lacteo'], false),
('Godita', 'Con lechuga, queso y crema. Con pollo +$12, bisteck +$12, queso oaxaca +$8.', 'antojitos', 28, 10, ARRAY['masa','lechuga','queso','crema'], ARRAY['lacteo'], false),
('Torta - La del Chavo del Ocho', 'Jamón, queso de puerco o huevo. Con mayonesa, aguacate, lechuga, cebolla y queso.', 'antojitos', 22, 8, ARRAY['pan telera','jamón','aguacate','lechuga'], ARRAY['gluten','lacteo'], false),
('Torta Milanesa', 'Milanesa de res con mayonesa, aguacate, lechuga, cebolla y queso.', 'antojitos', 48, 12, ARRAY['pan telera','milanesa','aguacate','lechuga'], ARRAY['gluten','lacteo'], false),
('Torta de Pollo', 'Pechuga de pollo con mayonesa, aguacate, lechuga, cebolla y queso.', 'antojitos', 38, 12, ARRAY['pan telera','pollo','aguacate','lechuga'], ARRAY['gluten','lacteo'], false),
('Torta de Bisteck', 'Bisteck con mayonesa, aguacate, lechuga, cebolla y queso.', 'antojitos', 48, 12, ARRAY['pan telera','bisteck','aguacate','lechuga'], ARRAY['gluten','lacteo'], false),
('Torta de Arrachera', 'Arrachera premium con mayonesa, aguacate, lechuga, cebolla y queso.', 'antojitos', 58, 14, ARRAY['pan telera','arrachera','aguacate','lechuga'], ARRAY['gluten','lacteo'], false),
('Torta de Huevo', 'Huevo con mayonesa, aguacate, lechuga, cebolla y queso.', 'antojitos', 32, 10, ARRAY['pan telera','huevo','aguacate','lechuga'], ARRAY['gluten','lacteo','huevo'], false),
('Torta Huevo con Chorizo', 'Huevo con chorizo, mayonesa, aguacate, lechuga, cebolla y queso.', 'antojitos', 38, 10, ARRAY['pan telera','huevo','chorizo','aguacate'], ARRAY['gluten','lacteo','huevo'], false),
('Enchiladas (3 pzas)', '3 piezas con lechuga, queso y crema. Verdes o suizas.', 'antojitos', 58, 10, ARRAY['tortilla','salsa','queso','crema','lechuga'], ARRAY['lacteo'], false),
('Enfrijoladas (3 pzas)', '3 piezas con lechuga, queso y crema. Verdes o suizas.', 'antojitos', 48, 10, ARRAY['tortilla','frijoles','queso','crema','lechuga'], ARRAY['lacteo'], false),
('Carne a la Tampiqueña', 'Bisteck o pechuga con chilaquiles, frijoles y ensalada.', 'antojitos', 78, 15, ARRAY['bisteck','tortilla','frijoles','queso'], ARRAY['lacteo'], false),

-- DESAYUNOS
('Chilaquiles', 'Gratinados, rojos o verdes. Con frijoles, crema y queso. Agrega: pollo +$28, arrachera +$38, 2 huevos +$18.', 'desayunos', 48, 12, ARRAY['tortilla','salsa','frijoles','crema','queso'], ARRAY['lacteo'], true),
('Molletes', 'Gratinados. Con frijoles, crema y queso. Agrega: pollo +$28, arrachera +$38, 2 huevos +$18.', 'desayunos', 48, 10, ARRAY['pan bolillo','frijoles','crema','queso'], ARRAY['gluten','lacteo'], false),
('Huevos al Gusto', 'Rancheros, divorciados, con tocino, con chorizo o con jamón. Con frijoles con queso y chilaquiles.', 'desayunos', 68, 12, ARRAY['huevo','frijoles','tortilla','queso'], ARRAY['lacteo','huevo'], false),
('Hot Cakes (3 pzas)', '3 piezas con mantequilla y miel. Agrega tocino +$18 o jamón +$18.', 'desayunos', 38, 10, ARRAY['harina','huevo','leche','mantequilla','miel'], ARRAY['gluten','lacteo','huevo'], false),

-- BEBIDAS
('Jugo Natural 250ml', 'Fresco al momento: naranja, zanahoria o verde.', 'bebidas', 28, 3, ARRAY['fruta fresca'], ARRAY[]::text[], false),
('Jugo Natural 500ml', 'Fresco al momento: naranja, zanahoria o verde.', 'bebidas', 48, 3, ARRAY['fruta fresca'], ARRAY[]::text[], false),
('Jugo Natural 1lt', 'Fresco al momento: naranja, zanahoria o verde.', 'bebidas', 78, 3, ARRAY['fruta fresca'], ARRAY[]::text[], false),
('Licuado 500ml', 'Chocomil, fresa o nuez.', 'bebidas', 48, 4, ARRAY['leche','fruta'], ARRAY['lacteo'], false),
('Licuado Nuez 500ml', 'Licuado de nuez.', 'bebidas', 58, 4, ARRAY['leche','nuez'], ARRAY['lacteo'], false),
('Licuado 1lt', 'Chocomil o fresa.', 'bebidas', 78, 4, ARRAY['leche','fruta'], ARRAY['lacteo'], false),
('Licuado Nuez 1lt', 'Licuado de nuez 1 litro.', 'bebidas', 88, 4, ARRAY['leche','nuez'], ARRAY['lacteo'], false),
('Agua Fresca 250ml', 'Horchata o jamaica.', 'bebidas', 28, 2, ARRAY['agua','fruta','azucar'], ARRAY[]::text[], false),
('Agua Fresca 500ml', 'Horchata o jamaica.', 'bebidas', 48, 2, ARRAY['agua','fruta','azucar'], ARRAY[]::text[], false),
('Agua Fresca 1lt', 'Horchata o jamaica.', 'bebidas', 78, 2, ARRAY['agua','fruta','azucar'], ARRAY[]::text[], false),
('Agua Natural', 'Agua fresca natural.', 'bebidas', 12, 1, ARRAY['agua'], ARRAY[]::text[], false),
('Café Ilimitado', 'Café americano de la casa, refill ilimitado.', 'bebidas', 28, 2, ARRAY['café'], ARRAY[]::text[], true),
('Café con Leche', 'Café con leche de la casa.', 'bebidas', 28, 2, ARRAY['café','leche'], ARRAY['lacteo'], false),
('Té', 'Té de la casa.', 'bebidas', 28, 2, ARRAY['té'], ARRAY[]::text[], false),
('Refresco 355ml', 'Coca-Cola, Sprite o Fanta.', 'bebidas', 35, 1, ARRAY['refresco'], ARRAY[]::text[], true),

-- EXTRAS
('Papas a la Francesa', 'Porción de papas a la francesa.', 'extras', 30, 8, ARRAY['papa','aceite'], ARRAY[]::text[], false),
('Aderezo Ranch Extra', 'Aderezo ranch adicional.', 'extras', 15, 1, ARRAY['aderezo'], ARRAY['lacteo'], false),
('Queso Extra', 'Queso adicional en cualquier platillo.', 'extras', 8, 1, ARRAY['queso'], ARRAY['lacteo'], false);

-- 5. Insertar promociones
INSERT INTO promociones (nombre, descripcion, dia_semana, precio, activa) VALUES
('Hamburguesa + Papas + Refresco', 'Hamburguesa con papas a la francesa y refresco', 'lunes', 88, true),
('1 kg de Alitas', '1 kilogramo de alitas al precio especial del martes', 'martes', 118, true),
('Tragos a Mitad de Precio', 'Todos los tragos al 50% de descuento', 'miercoles', NULL, true),
('1/2 kg Boneless', 'Medio kilo de boneless al precio especial del jueves', 'jueves', 120, true),
('20 Alitas + 2 Refrescos + Papas', '20 alitas con 2 refrescos y papas a la francesa', 'viernes', 280, true),
('Dedos de Queso', 'Dedos de queso al precio especial del domingo', 'domingo', 80, true),
('Veggies', 'Veggies al precio especial del domingo', 'domingo', 70, true),
('1 kg de Alitas por $198', 'Promoción semanal: 1 kilogramo de alitas', 'siempre', 198, true),
('Hamburguesa Baby con Papas', 'Hamburguesa baby con papas incluidas', 'siempre', 98, true);
