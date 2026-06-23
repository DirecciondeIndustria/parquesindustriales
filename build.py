# Ensambla los archivos finales desde template.html (fuente unica de verdad).
#   - index.html : archivo autocontenido (todo inline) para uso/distribucion.
#   - dev.html   : version con <script src> para desarrollo/depuracion.
# Reemplaza cada marcador <!--INLINE:ruta--> segun el destino.
import io, re

def read(p):
    with io.open(p, encoding='utf-8') as f:
        return f.read()

tpl = read('template.html')

# index.html -> inline del contenido en <script>
def repl_inline(m):
    path = m.group(1).strip()
    code = read(path)
    if '</script' in code.lower():
        print('WARN: </script> en', path)
    return '<script>\n' + code + '\n</script>'

# dev.html -> referencia externa <script src>
def repl_src(m):
    path = m.group(1).strip()
    return '<script src="' + path + '"></script>'

index_out = re.sub(r'<!--INLINE:(.*?)-->', repl_inline, tpl)
with io.open('index.html', 'w', encoding='utf-8') as f:
    f.write(index_out)
print('index.html generado:', len(index_out), 'bytes')

dev_out = re.sub(r'<!--INLINE:(.*?)-->', repl_src, tpl)
with io.open('dev.html', 'w', encoding='utf-8') as f:
    f.write(dev_out)
print('dev.html generado:', len(dev_out), 'bytes')
