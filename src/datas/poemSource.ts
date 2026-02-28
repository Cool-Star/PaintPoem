import type { Poem } from '../types/poem';




// 根据输入计算唯一uuid
const calculateId = (input: string) => {
  return input.split('').reduce((id, char) => (id * 31 + char.charCodeAt(0)) % 1000000007, 0);
};

export const domain = "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/refs/heads/master";


export const formatter = (data: Poem[], source: { url: string, groups: string[] }) => {
  return data.map((poem) => {
    // 获取第一段内容作为唯一标识的一部分
    const firstParagraph = poem.paragraphs?.[0] || '';
    return {
      ...poem,
      groups: source.groups,
      id: poem.id || calculateId(`${source.groups.join('-')}-${poem.title}-${poem.author}-${firstParagraph}`),
    };
  });
};

export const poemSource = [
  {
    name: '五代诗词',
    urls: [
      {
        url: '/五代诗词/nantang/poetrys.json',
        groups: ['五代诗词', '南唐'],
      },
      {
        url: '/五代诗词/huajianji/huajianji-1-juan.json',
        groups: ['五代诗词', '花间集'],
      },
      {
        url: '/五代诗词/huajianji/huajianji-2-juan.json',
        groups: ['五代诗词', '花间集'],
      },
      {
        url: '/五代诗词/huajianji/huajianji-3-juan.json',
        groups: ['五代诗词', '花间集'],
      },
      {
        url: '/五代诗词/huajianji/huajianji-4-juan.json',
        groups: ['五代诗词', '花间集'],
      },
      {
        url: '/五代诗词/huajianji/huajianji-5-juan.json',
        groups: ['五代诗词', '花间集'],
      },
      {
        url: '/五代诗词/huajianji/huajianji-6-juan.json',
        groups: ['五代诗词', '花间集'],
      },
      {
        url: '/五代诗词/huajianji/huajianji-7-juan.json',
        groups: ['五代诗词', '花间集'],
      },
      {
        url: '/五代诗词/huajianji/huajianji-8-juan.json',
        groups: ['五代诗词', '花间集'],
      },
      {
        url: '/五代诗词/huajianji/huajianji-9-juan.json',
        groups: ['五代诗词', '花间集'],
      },
      {
        url: '/五代诗词/huajianji/huajianji-x-juan.json',
        groups: ['五代诗词', '花间集'],
      },
    ],
  },
  {
    name: '元曲',
    urls: [
      {
        url: '/元曲/yuanqu.json',
        groups: ['元曲'],
      },
    ],
  },
  {
    name: '全唐诗',
    urls: [
      ...new Array(255).fill(0).map((_, index) => {
        return {
          url: `/全唐诗/poet.song.${index * 1000}.json`,
          groups: ['全唐诗'],
        }
      }),
      {
        url: '/全唐诗/唐诗补录.json',
        groups: ['全唐诗'],
      },
      {
        url: '/全唐诗/唐诗三百首.json',
        groups: ['全唐诗'],
      },
    ],
  },
  {
    name: '四书五经',
    urls: [
      {
        url: '/四书五经/daxue.json',
        groups: ['四书五经', '大学'],
      },
      {
        url: '/四书五经/mengzi.json',
        groups: ['四书五经', '孟子'],
      },
      {
        url: '/四书五经/zhongyong.json',
        groups: ['四书五经', '中庸'],
      }
    ],
    formatter: (data: Poem[], source: { url: string, groups: string[] }) => {
      return data.map((poem) => {
        // 获取第一段内容作为唯一标识的一部分
        const firstParagraph = poem.paragraphs?.[0] || '';
        return {
          ...poem,
          id: poem.id || calculateId(`${source.groups.join('-')}-${poem.chapter}-${firstParagraph}`),
          groups: source.groups,
          author: poem.author || `${source.groups[source.groups.length - 1]}`,
          title: poem.title || `${poem.chapter}`
        };
      });
    }
  },
  {
    name: '宋词',
    urls: [
      ...new Array(22).fill(0).map((_, index) => {
        return {
          url: `/宋词/ci.song.${index * 1000}.json`,
          groups: ['宋词'],
        }
      }),
      {
        url: '/宋词/ci.song.2019y.json',
        groups: ['宋词'],
      },
    ],
    formatter: (data: Poem[], source: { url: string, groups: string[] }) => {
      return data.map((poem) => {
        // 获取第一段内容作为唯一标识的一部分
        const firstParagraph = poem.paragraphs?.[0] || '';
        return {
          ...poem,
          id: poem.id || calculateId(`${source.groups.join('-')}-${poem.rhythmic}-${poem.author}-${firstParagraph}`),
          title: poem.title || poem.rhythmic,
          groups: source.groups,
        };
      });
    }
  },
  {
    name: '御定全唐詩',
    urls: [
      ...new Array(900).fill(0).map((_, index) => {
        return {
          url: `/御定全唐詩/json/${String(index + 1).padStart(3, '0')}.json`,
          groups: ['御定全唐詩'],
        }
      }),
    ],
    formatter: (data: Poem[], source: { url: string, groups: string[] }) => {
      return data.map((poem) => {
        // 获取第一段内容作为唯一标识的一部分
        const firstParagraph = poem.paragraphs?.[0] || '';
        return {
          ...poem,
          id: poem.id || calculateId(`${source.groups.join('-')}-${poem.title}-${poem.author}-${firstParagraph}`),
          notes: poem.notes?.filter(item => !!item),
        };
      });
    }
  },
  {
    name: "曹操诗集",
    urls: [
      {
        url: '/曹操诗集/caocao.json',
        groups: ['曹操诗集'],
      },
    ],
    formatter: (data: Poem[], source: { url: string, groups: string[] }) => {
      return data.map((poem) => {
        // 获取第一段内容作为唯一标识的一部分
        const firstParagraph = poem.paragraphs?.[0] || '';
        return {
          ...poem,
          id: poem.id || calculateId(`${source.groups.join('-')}-${poem.title}-${firstParagraph}`),
          groups: source.groups,
          author: "曹操",
        };
      });
    }
  },
  {
    name: "楚辞",
    urls: [
      {
        url: '/楚辞/chuci.json',
        groups: ['楚辞'],

      },
    ],
    formatter: (data: Poem[], source: { url: string, groups: string[] }) => {
      return data.map((poem) => {
        return {
          ...poem,
          paragraphs: poem.paragraphs || poem.content,
          groups: source.groups,
        };
      });
    }
  },
  {
    name: "水墨唐诗",
    urls: [
      {
        url: '/水墨唐诗/shuimotangshi.json',
        groups: ['水墨唐诗'],
      },
    ],
  },
  {
    name: "纳兰性德",
    urls: [
      {
        url: '/纳兰性德/纳兰性德诗集.json',
        groups: ['纳兰性德'],
      },
    ],
    formatter: (data: Poem[], source: { url: string, groups: string[] }) => {
      return data.map((poem) => {
        // 获取第一段内容作为唯一标识的一部分
        const firstParagraph = poem.paragraphs?.[0] || '';
        return {
          ...poem,
          paragraphs: poem.paragraphs || poem.para,
          id: poem.id || calculateId(`${source.groups.join('-')}-${poem.title}-${firstParagraph}`),
          groups: source.groups,
        };
      });
    }
  },
  {
    name: "蒙学",
    urls: [

      {
        url: '/蒙学/baijiaxing.json',
        groups: ['蒙学', '百家姓'],
      },
      {
        url: '/蒙学/dizigui.json',
        groups: ['蒙学', '弟子规'],
      },
      {
        url: '/蒙学/guwenguanzhi.json',
        groups: ['蒙学', '古文观止'],
      },
      {
        url: '/蒙学/qianjiashi.json',
        groups: ['蒙学', '千家诗'],
      },
      {
        url: '/蒙学/qianziwen.json',
        groups: ['蒙学', '千字文'],
      },
      {
        url: '/蒙学/sanzijing-new.json',
        groups: ['蒙学', '三字经'],
      },
      {
        url: '/蒙学/sanzijing-traditional.json',
        groups: ['蒙学', '三字经'],
      },
      {
        url: '/蒙学/shenglvqimeng.json',
        groups: ['蒙学', '声律启蒙'],
      },
      {
        url: '/蒙学/tangshisanbaishou.json',
        groups: ['蒙学', '唐诗三百首'],
      },
      {
        url: '/蒙学/wenzimengqiu.json',
        groups: ['蒙学', '文字蒙求'],
      },
      {
        url: '/蒙学/youxueqionglin.json',
        groups: ['蒙学', '幼学琼林'],
      },
      {
        url: '/蒙学/zengguangxianwen.json',
        groups: ['蒙学', '增广贤文'],
      },
      {
        url: '/蒙学/zhuzijiaxun.json',
        groups: ['蒙学', '朱子家训'],
      },
    ],
  },
  {
    name: "论语",
    urls: [
      {
        url: '/论语/lunyu.json',
        groups: ['论语'],
      },
    ],
    formatter: (data: Poem[], source: { url: string, groups: string[] }) => {
      return data.map((poem) => {
        // 获取第一段内容作为唯一标识的一部分
        const firstParagraph = poem.paragraphs?.[0] || '';
        return {
          ...poem,
          title: poem.chapter,
          author: poem.author || '孔子',
          id: poem.id || calculateId(`${source.groups.join('-')}-${poem.title}-${firstParagraph}`),
          groups: source.groups,
        };
      });
    }
  },
  {
    name: "诗经",
    urls: [
      {
        url: '/诗经/shijing.json',
        groups: ['诗经'],
      },
    ],
    formatter: (data: Poem[], source: { url: string, groups: string[] }) => {
      return data.map((poem) => {
        // 获取第一段内容作为唯一标识的一部分
        const firstParagraph = poem.paragraphs?.[0] || poem.content?.[0] || '';
        return {
          ...poem,
          paragraphs: poem.paragraphs || poem.content,
          author: poem.author || poem.section || '未知',
          id: poem.id || calculateId(`${source.groups.join('-')}-${poem.title}-${firstParagraph}`),
          groups: [...source.groups, poem.section],
        };
      });
    }
  }
];
