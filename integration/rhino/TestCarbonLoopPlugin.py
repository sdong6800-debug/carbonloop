import System
import Rhino

plugin_id = System.Guid("c7ab61d4-ea98-4f9d-8a74-012041696b97")

try:
    loaded = Rhino.PlugIns.PlugIn.LoadPlugIn(plugin_id)
    Rhino.RhinoApp.WriteLine("CarbonLoop plugin load result: {0}".format(loaded))
except Exception as error:
    Rhino.RhinoApp.WriteLine("CarbonLoop plugin load exception: {0}".format(error))
