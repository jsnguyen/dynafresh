import os
import time

import numpy as np
import matplotlib.pyplot as plt


while True:
    print('Making plot!')
    xs = np.random.normal(size=100)
    ys = np.random.normal(size=100)
    plt.plot(xs,ys,color='C1')
    output_dir = '/Users/jsn/landing/code/dynafresh/public/images'
    plt.savefig(os.path.join(output_dir,'plot.png'),bbox_inches='tight')
    plt.close()
    time.sleep(4)
