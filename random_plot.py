from pathlib import Path
import time

import numpy as np
import matplotlib.pyplot as plt

while True:
    print('Making plot!')
    xs = np.random.normal(size=100)
    ys = np.random.normal(size=100)

    fig, ax = plt.subplots()
    ax.plot(xs,ys,color='C1')

    output_dir = Path('./public/images')
    output_dir.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_dir / 'plot.png' ,bbox_inches='tight')
    plt.close()

    time.sleep(4)
