"""DSH's small image bridge: no third-party packages beyond ComfyUI itself."""
import nodes
import comfy.utils


class DSHPostScale:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required':{'image':('IMAGE',),'reference':('IMAGE',),'factor':('FLOAT',{'default':2.,'min':.1,'max':8.,'step':.01})}}
    RETURN_TYPES=('IMAGE',)
    FUNCTION='scale'
    CATEGORY='DSH/Post controls'

    def scale(self,image,reference,factor):
        width=round(reference.shape[2]*factor);height=round(reference.shape[1]*factor)
        if min(width,height)<1 or max(width,height)>16384:raise ValueError('DSH 放大结果需为 1–16384 像素')
        return (comfy.utils.common_upscale(image.movedim(-1,1),width,height,'lanczos','disabled').movedim(1,-1),)


class DSHPostImageSize:
    @classmethod
    def INPUT_TYPES(cls):return {'required':{'image':('IMAGE',)}}
    RETURN_TYPES=('INT','INT')
    RETURN_NAMES=('width','height')
    FUNCTION='size'
    CATEGORY='DSH/Post controls'
    def size(self,image):return (image.shape[2],image.shape[1])


class DSHPostStage(nodes.PreviewImage):
    RETURN_TYPES=('IMAGE',)
    RETURN_NAMES=('image',)
    FUNCTION='stage'
    CATEGORY='DSH/Post controls'
    @classmethod
    def INPUT_TYPES(cls):
        spec=super().INPUT_TYPES();spec['optional']={**spec.get('optional',{}),'mask':('MASK',)};return spec
    def stage(self,images,filename_prefix='DSH-stage',prompt=None,extra_pnginfo=None,mask=None):
        result=self.save_images(images,filename_prefix,prompt,extra_pnginfo)
        if mask is not None and not bool(mask.any().item()):
            result['ui']['dsh_note']=['未获得可细化面部区域，保留输入图片']
        return {'ui':result['ui'],'result':(images,)}


NODE_CLASS_MAPPINGS={'DSHPostScale':DSHPostScale,'DSHPostImageSize':DSHPostImageSize,'DSHPostStage':DSHPostStage}
NODE_DISPLAY_NAME_MAPPINGS={'DSHPostScale':'DSH · Scale to factor','DSHPostImageSize':'DSH · Image size','DSHPostStage':'DSH · Stage checkpoint'}
