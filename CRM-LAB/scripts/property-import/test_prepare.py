import unittest
from prepare_tokko import links, parse_listing

PAGE='''<div class="title-address">Calle Ejemplo 123</div><div id="ficha_detalle_cuerpo"><div class="ficha_detalle_item"><b>Tipo de Propiedad</b><br>Casa</div><div class="ficha_detalle_item"><b>Ubicación</b><br>Capital</div></div><div id="ficha_detalle_ref">(REF. DEMO1)</div><div class="operations-box"><div class="operation-div"><div class="operation-type-div">VENTA</div><div class="operation-val">USD100.000</div></div></div><div id="prop-desc">&lt;p&gt;Casa de ejemplo&lt;br&gt;Con patio&lt;/p&gt;</div><section id="ficha_servicios"><div class="titulo2">SERVICIOS</div><ul><li>Agua corriente</li></ul></section><img class="zoomImg" src="https://media.example/w_pics/1.jpg"><img class="zoomImg" src="https://media.example/pictures/2.jpg">'''

class ParserTest(unittest.TestCase):
    def parse(self, page=PAGE):
        return parse_listing(page,'https://inmobiliaria.example/p/1','1','Provincia ejemplo','Ciudad ejemplo',{'Capital':'Ciudad ejemplo'})
    def test_details_and_photo_order(self):
        value=self.parse()
        self.assertIn('Casa de ejemplo\nCon patio',value['property']['description'])
        self.assertIn('Agua corriente',value['property']['description'])
        self.assertEqual(value['offers'][0]['amount'],'100000')
        self.assertEqual(value['property']['city'],'Ciudad ejemplo')
        self.assertEqual(len(value['photos']),2)
        self.assertIn('/pictures/',value['photos'][1])
        self.assertIn('No informado:',value['property']['privateNotes'])
    def test_missing_price(self):
        value=self.parse(PAGE.replace('USD100.000','Consultar'))
        self.assertEqual(value['offers'],[])
        self.assertIn('Sin precio publicado',value['property']['privateNotes'])
    def test_pagination_marker_in_script_does_not_end_catalog(self):
        self.assertEqual(links('<script>var end="--NoMoreProperties--"</script><a href="/p/123-demo">Ficha</a>'),{'123':'/p/123-demo'})
        self.assertEqual(links('--NoMoreProperties--'),{})
    def test_unrecognized_template_fails(self):
        with self.assertRaises(ValueError):self.parse('<html>Otra plantilla</html>')

if __name__=='__main__': unittest.main()
